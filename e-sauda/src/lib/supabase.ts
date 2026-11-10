import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Loud, obvious failure instead of a silent broken client — saves you a confusing debugging
  // session the first time you forget to fill in .env.local.
  console.error(
    'Missing Supabase env vars. Copy .env.example to .env.local and fill in your project URL and anon key.',
  )
}

export const supabase = createClient(url, anonKey)
