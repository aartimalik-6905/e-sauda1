// Deploy: supabase functions deploy delete-account
// No new secrets needed -- uses the same SUPABASE_SERVICE_ROLE_KEY every other
// service-role Edge Function in this app already relies on.
//
// See account_deletion_schema.sql for the full reasoning on why this is a soft
// delete (ban + anonymize) rather than a literal DELETE FROM auth.users.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Missing Authorization header' }, 401)

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()
    if (userError || !user) return jsonResponse({ error: 'Not authenticated' }, 401)

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Ban indefinitely (100 years) rather than delete the auth.users row -- this is
    // what lets historical messages/ratings/reports the OTHER party is involved
    // in stay completely intact. See the schema file's comment for the full reasoning.
    const { error: banError } = await adminClient.auth.admin.updateUserById(user.id, {
      email: `deleted-${user.id}@e-sauda.invalid`,
      password: crypto.randomUUID() + crypto.randomUUID(),
      ban_duration: '876000h',
    })
    if (banError) {
      console.error('Failed to ban user during deletion:', banError)
      return jsonResponse({ error: 'Could not complete account deletion' }, 500)
    }

    const { error: profileError } = await adminClient
      .from('profiles')
      .update({ display_name: 'Deleted user', city: null, deleted_at: new Date().toISOString() })
      .eq('id', user.id)
    if (profileError) {
      // The account is already banned at this point (can't log in) even if this
      // particular update fails -- log it for manual follow-up rather than leaving
      // the person stuck retrying a whole deletion that mostly already happened.
      console.error('Failed to anonymize profile during deletion:', profileError)
    }

    const { error: listingsError } = await adminClient
      .from('listings')
      .update({ status: 'removed' })
      .eq('owner_id', user.id)
      .eq('status', 'active')
    if (listingsError) {
      console.error('Failed to remove active listings during deletion:', listingsError)
    }

    return jsonResponse({ success: true })
  } catch (err) {
    console.error('delete-account error:', err)
    return jsonResponse({ error: 'Unexpected server error' }, 500)
  }
})
