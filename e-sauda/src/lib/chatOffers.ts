import { supabase } from './supabase'
import { ChatOffer } from '../types'

function mapRow(row: any): ChatOffer {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    listingId: row.listing_id,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    amount: Number(row.amount),
    status: row.status,
    offeredBy: row.offered_by ?? 'buyer',
    supersededBy: row.superseded_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// Powers the offer cards rendered inline in a chat thread (Messages.tsx).
export async function fetchOffers(conversationId: string): Promise<ChatOffer[]> {
  const { data, error } = await supabase
    .from('chat_offers')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapRow)
}

// Proposes a price in a chat thread. Either the buyer or the seller can call
// this to open a negotiation (whoever's turn it is — the one-pending-offer-
// per-conversation constraint in chat_offers_negotiation_schema.sql blocks a
// second one while one is already open). listing_id/seller_id/buyer_id and
// who-offered-it are all filled in server-side from the conversation and
// auth.uid() (see chat_offers_fill_from_conversation), so this can't be
// pointed at the wrong listing/party or spoof who actually made the offer.
export async function makeOffer(
  conversationId: string,
  actingUserId: string,
  amount: number,
): Promise<ChatOffer> {
  const { data, error } = await supabase
    .from('chat_offers')
    .insert({ conversation_id: conversationId, buyer_id: actingUserId, amount })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data)
}

export async function acceptOffer(offerId: string): Promise<void> {
  const { error } = await supabase.from('chat_offers').update({ status: 'accepted' }).eq('id', offerId)
  if (error) throw error
}

export async function declineOffer(offerId: string): Promise<void> {
  const { error } = await supabase.from('chat_offers').update({ status: 'declined' }).eq('id', offerId)
  if (error) throw error
}

export async function withdrawOffer(offerId: string): Promise<void> {
  const { error } = await supabase.from('chat_offers').update({ status: 'withdrawn' }).eq('id', offerId)
  if (error) throw error
}

// Lets whichever side did NOT make the current pending offer propose a
// different amount instead of just accepting/declining -- real negotiation,
// not a one-shot take-it-or-leave-it. Implemented server-side as an atomic
// decline-old + insert-new pair (see counter_chat_offer in
// chat_offers_negotiation_schema.sql) so it can't race the "one pending offer
// per conversation" constraint, and offered_by is derived from auth.uid()
// there -- never trusted from this call's arguments.
export async function counterOffer(offerId: string, amount: number): Promise<ChatOffer> {
  const { data, error } = await supabase.rpc('counter_chat_offer', {
    p_offer_id: offerId,
    p_amount: amount,
  })
  if (error) throw error
  return mapRow(data)
}

// Used by ListingDetail to show the buyer the real price they're about to be
// charged (rather than the listing's original asking price) when an
// accepted offer is waiting to be used. Not security-relevant by itself —
// the actual charge is re-derived server-side by the payment-order and verification
// functions regardless of what this returns.
export async function fetchMyAcceptedOffer(
  listingId: string,
  buyerId: string,
): Promise<ChatOffer | null> {
  const { data, error } = await supabase
    .from('chat_offers')
    .select('*')
    .eq('listing_id', listingId)
    .eq('buyer_id', buyerId)
    .eq('status', 'accepted')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data ? mapRow(data) : null
}

// Live-updates offer cards in the open chat thread (new offers, accept/decline/
// withdraw). Call the returned function on unmount to avoid leaking the socket.
export function subscribeToOffers(
  conversationId: string,
  onChange: (offer: ChatOffer) => void,
): () => void {
  const channel = supabase
    .channel(`chat-offers-${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'chat_offers',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onChange(mapRow(payload.new)),
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
