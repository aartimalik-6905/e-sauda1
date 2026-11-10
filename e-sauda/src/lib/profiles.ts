import { supabase } from './supabase'

// Lets a user fix their own display_name after the fact — e.g. accounts stuck as
// "New user" from before the signUp() metadata fix, or anyone who just wants to
// rename themselves. RLS's existing "Users can update their own profile" policy
// (supabase/schema.sql) already restricts this to auth.uid() = id.
export async function updateDisplayName(userId: string, displayName: string): Promise<void> {
  const trimmed = displayName.trim()
  if (!trimmed) throw new Error('Name cannot be empty')
  const { error } = await supabase.from('profiles').update({ display_name: trimmed }).eq('id', userId)
  if (error) throw error
}

export interface PublicProfile {
  id: string
  displayName: string
  city: string | null
  trustScore: number
  verified: boolean
  ratingAvg: number | null
  ratingCount: number
  joinedAt: string
}

// Public-facing profile lookup — used by the /seller/:id page so a buyer can see who
// they're dealing with before purchasing. Only exposes fields that are meant to be
// public (RLS on `profiles` already allows anyone to select these columns; see
// supabase/schema.sql's "Profiles are viewable by everyone" policy from the auth branch).
export async function fetchPublicProfile(userId: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, city, trust_score, verified, rating_avg, rating_count, created_at')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  return {
    id: data.id,
    displayName: data.display_name,
    city: data.city,
    trustScore: data.trust_score,
    verified: data.verified,
    ratingAvg: data.rating_avg,
    ratingCount: data.rating_count,
    joinedAt: data.created_at,
  }
}