import { supabase } from './supabase'

// Shared helper for calling Supabase Edge Functions and surfacing server errors.
export async function invokeFunction<T>(name: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    // error.message from supabase-js is just a generic "Edge Function returned a
    // non-2xx status code" -- it doesn't surface what the function actually said.
    // error.context is the real Response object; our functions always return
    // `{ error: "..." }` as the body on failure, so read that out specifically.
    let detail: string | undefined
    try {
      const body = await error.context?.json()
      detail = body?.error
    } catch {
      // Response body wasn't JSON (e.g. a network-level failure with no body at all)
      // -- fall through to the generic message below.
    }
    throw new Error(detail || error.message || 'Payment service is unavailable right now.')
  }
  if (data?.error) throw new Error(data.error)
  return data as T
}
