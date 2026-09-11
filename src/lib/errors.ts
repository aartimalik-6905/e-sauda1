// Supabase/PostgREST errors often surface as a raw Postgres error (a constraint name,
// an RLS policy violation code, or a bare "JSON object requested, multiple (or no) rows
// returned") -- technically accurate, but meaningless to whoever's staring at it in the
// UI. This maps the common cases to a plain sentence, and otherwise falls back to
// whatever message the error actually has rather than swallowing it.
export function describeSupabaseError(err: any, fallback = 'Something went wrong. Please try again.'): string {
  if (!err) return fallback
  const code: string | undefined = err.code
  const message: string = err.message || err.error_description || ''
  const lower = message.toLowerCase()

  // Postgres RLS violation / permission denied.
  if (code === '42501' || lower.includes('permission denied') || lower.includes('row-level security')) {
    return "You don't have permission to do that."
  }
  // Foreign key violation -- the row it points at doesn't exist (e.g. the order or
  // listing it references was already deleted).
  if (code === '23503') {
    return 'That record no longer exists — try refreshing the page.'
  }
  // Not-null violation.
  if (code === '23502') {
    return 'Please fill in all the required fields.'
  }
  // Unique violation.
  if (code === '23505') {
    return 'That already exists — try refreshing the page.'
  }
  // Check constraint violation (e.g. a status value outside the allowed set).
  if (code === '23514') {
    return "That value isn't allowed here."
  }
  // PostgREST's ".single()" found 0 or >1 rows.
  if (lower.includes('json object requested') || lower.includes('multiple (or no) rows')) {
    return "Couldn't find that — it may have just changed. Try refreshing the page."
  }
  // Table not exposed / migration not applied yet.
  if (lower.includes('relation') && lower.includes('does not exist')) {
    return "This feature isn't fully set up yet — please try again shortly."
  }
  // Network-level failures (offline, DNS, CORS, the request never reaching the server).
  if (err instanceof TypeError || lower.includes('failed to fetch') || lower.includes('networkerror')) {
    return 'Network error — check your connection and try again.'
  }

  return message || fallback
}
