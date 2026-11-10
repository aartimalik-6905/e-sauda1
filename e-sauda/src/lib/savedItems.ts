import { supabase } from './supabase'
import { mapRow } from './listings'
import { Listing } from '../types'

// Just the ids — cheap to fetch, used to light up ❤️ buttons across Browse/Home/
// SellerProfile without re-fetching full listing rows.
export async function fetchSavedListingIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('saved_items')
    .select('listing_id')
    .eq('user_id', userId)
  if (error) throw error
  return new Set((data ?? []).map((row) => row.listing_id as string))
}

// Full listing rows for the wishlist page, most recently saved first.
export async function fetchSavedListings(userId: string): Promise<Listing[]> {
  const { data, error } = await supabase
    .from('saved_items')
    .select('created_at, listings(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? [])
    .filter((row: any) => row.listings) // guards against a listing that's since been deleted
    .map((row: any) => mapRow(row.listings))
}

export async function saveListing(userId: string, listingId: string): Promise<void> {
  // Upsert instead of insert: saving something already-saved (e.g. a fast double-click)
  // no-ops instead of erroring on the unique constraint.
  const { error } = await supabase
    .from('saved_items')
    .upsert({ user_id: userId, listing_id: listingId }, { onConflict: 'user_id,listing_id' })
  if (error) throw error
}

export async function unsaveListing(userId: string, listingId: string): Promise<void> {
  const { error } = await supabase
    .from('saved_items')
    .delete()
    .eq('user_id', userId)
    .eq('listing_id', listingId)
  if (error) throw error
}
