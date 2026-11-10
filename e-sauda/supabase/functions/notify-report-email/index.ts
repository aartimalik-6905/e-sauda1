// Deploy: supabase functions deploy notify-report-email
// Requires a RESEND_API_KEY secret: supabase secrets set RESEND_API_KEY=re_...
// Sign up free at resend.com — no credit card needed, 100 emails/day / 3,000/month
// on the free tier, which is enormously more than a reports inbox needs.
//
// IMPORTANT — read before assuming this "just works" the moment a key is set:
// Until you verify a sending domain in Resend, you can only send FROM their shared
// address (onboarding@resend.dev) — sending from anything @e-sauda.* or your own
// domain needs domain verification first (SPF/DKIM DNS records). Some providers also
// restrict which addresses you can send TO before verification -- check your Resend
// dashboard if emails aren't arriving even though this function reports success.
//
// This is deliberately called fire-and-forget from submitReport() (lib/reports.ts) --
// a failed email should never block someone from successfully filing a report. The
// report itself is always saved to the database regardless of whether this succeeds.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Fix here if this was a typo -- see the reasoning above.
const NOTIFY_EMAILS = ['annuanshu005@gmail.com', 'malikaarti6905@gmail.com']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { reason, details, listingId, reportedUserId } = await req.json()

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      // Not a hard failure -- the report is already saved by the time this function
      // is called. Just means no email goes out until the secret is set.
      console.error('RESEND_API_KEY not set — report was saved but no email was sent.')
      return new Response(JSON.stringify({ success: false, reason: 'no_api_key' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Server-side lookups so the email has real context, not just raw IDs — reads
    // this with the caller's own permissions (their existing "view own reports" RLS
    // already covers what they just filed), no service role needed for this part.
    let listingTitle: string | null = null
    if (listingId) {
      const { data } = await userClient.from('listings').select('title').eq('id', listingId).maybeSingle()
      listingTitle = data?.title ?? null
    }

    const subject = `New report: ${reason}${listingTitle ? ` — ${listingTitle}` : ''}`
    const bodyLines = [
      `Reason: ${reason}`,
      details ? `Details: ${details}` : null,
      listingId ? `Listing ID: ${listingId}${listingTitle ? ` (${listingTitle})` : ''}` : null,
      reportedUserId ? `Reported user ID: ${reportedUserId}` : null,
      `Reporter ID: ${user.id}`,
      `Filed at: ${new Date().toISOString()}`,
      ``,
      `Review this in the admin dashboard: /admin`,
    ].filter(Boolean)

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'e-Sauda Reports <onboarding@resend.dev>',
        to: NOTIFY_EMAILS,
        subject,
        text: bodyLines.join('\n'),
      }),
    })

    if (!resendRes.ok) {
      const errBody = await resendRes.text()
      console.error('Resend send failed:', errBody)
      return new Response(JSON.stringify({ success: false, reason: 'send_failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('notify-report-email error:', err)
    // Still a 200 with success:false, not a 500 -- see the fire-and-forget note above;
    // this function's failure should never surface as an error to the reporting user.
    return new Response(JSON.stringify({ success: false, reason: 'unexpected_error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
