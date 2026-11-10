// Shared between both functions -- browsers preflight cross-origin POSTs from the
// React app (served from a different origin than *.supabase.co/functions/v1) with an
// OPTIONS request, which needs these same headers or the browser blocks the real
// request before it's even sent.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
