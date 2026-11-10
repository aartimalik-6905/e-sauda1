import { supabase } from './supabase'
import { Rating } from '../types'

function mapRow(row: any): Rating {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    raterId: row.rater_id,
    ratedUserId: row.rated_user_id,
    stars: row.stars,
    comment: row.comment,
    createdAt: row.created_at,
  }
}

// Called after a deal is done. All the real rules (the listing must be marked sold,
// the caller must be one of the two people in the chat, one rating per person per
// conversation, who the "other party" even is) are enforced atomically in
// submit_rating() itself — this is just the client-side call.
export async function submitRating(
  conversationId: string,
  stars: number,
  comment?: string,
): Promise<Rating> {
  const { data, error } = await supabase.rpc('submit_rating', {
    p_conversation_id: conversationId,
    p_stars: stars,
    p_comment: comment || null,
  })
  if (error) throw error
  return mapRow(data)
}

// Lets the UI know whether the current user has already rated a given conversation,
// so it can show "You rated this ★★★★★" instead of the rating form again.
export async function fetchMyRatingForConversation(
  conversationId: string,
  raterId: string,
): Promise<Rating | null> {
  const { data, error } = await supabase
    .from('ratings')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('rater_id', raterId)
    .maybeSingle()
  if (error) throw error
  return data ? mapRow(data) : null
}

// Recent reviews a user has received — not wired into a UI yet in this branch, but
// ready for a public seller-profile page later.
export async function fetchRatingsForUser(userId: string): Promise<Rating[]> {
  const { data, error } = await supabase
    .from('ratings')
    .select('*')
    .eq('rated_user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapRow)
}
