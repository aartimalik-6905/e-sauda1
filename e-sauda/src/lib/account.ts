import { invokeFunction } from './edgeFunctions'
import { supabase } from './supabase'

// See supabase/functions/delete-account/index.ts and account_deletion_schema.sql for
// what this actually does (soft-delete/anonymize, not a literal row deletion) and why.
export async function deleteAccount(): Promise<void> {
  await invokeFunction('delete-account', {})
  // The Edge Function already banned this account server-side, but the browser's
  // current session tokens could still work for a short window until they'd naturally
  // expire/refresh-fail -- signing out here immediately, client-side, closes that gap
  // rather than leaving the person looking "logged in" to a deleted account.
  await supabase.auth.signOut()
}
