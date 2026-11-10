import { supabase } from './supabase'
import { Conversation, ConversationSummary, Message } from '../types'
import { RealtimeChannel } from '@supabase/supabase-js'
import { scanMessage } from './moderation'

function mapConversation(row: any): Conversation {
  return {
    id: row.id,
    listingId: row.listing_id,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    createdAt: row.created_at,
  }
}

function mapMessage(row: any): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
    flagged: row.flagged ?? false,
    flagReasons: row.flag_reasons ?? [],
  }
}

// Called from the listing detail page's "Chat with seller" button. Resumes the
// existing thread for this buyer+listing if one already exists (the unique
// constraint in chat_schema.sql guarantees only one), otherwise creates it.
export async function getOrCreateConversation(
  listingId: string,
  buyerId: string,
  sellerId: string,
): Promise<Conversation> {
  const { data: existing, error: findError } = await supabase
    .from('conversations')
    .select('*')
    .eq('listing_id', listingId)
    .eq('buyer_id', buyerId)
    .maybeSingle()
  if (findError) throw findError
  if (existing) return mapConversation(existing)

  const { data, error } = await supabase
    .from('conversations')
    .insert({ listing_id: listingId, buyer_id: buyerId, seller_id: sellerId })
    .select('*')
    .single()
  if (error) throw error
  return mapConversation(data)
}

// Powers the inbox list (left pane of /messages). Joins in the listing's
// title/price/photo so each row is ready to render without extra round trips,
// then fetches each thread's latest message (fine at personal-marketplace
// scale; would want a DB view or RPC if this ever needs to handle thousands
// of conversations per user).
export async function fetchConversations(userId: string): Promise<ConversationSummary[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*, listings(title, price, emoji, photo_urls, status)')
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('created_at', { ascending: false })
  if (error) throw error
  if (!data || data.length === 0) return []

  const summaries = await Promise.all(
    data.map(async (row: any) => {
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('body, created_at')
        .eq('conversation_id', row.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      return {
        ...mapConversation(row),
        listingTitle: row.listings?.title ?? 'Listing removed',
        listingPrice: Number(row.listings?.price ?? 0),
        listingEmoji: row.listings?.emoji ?? '📦',
        listingPhotoUrl: row.listings?.photo_urls?.[0] ?? null,
        listingStatus: row.listings?.status ?? null,
        otherPartyId: row.buyer_id === userId ? row.seller_id : row.buyer_id,
        lastMessageBody: lastMsg?.body ?? null,
        lastMessageAt: lastMsg?.created_at ?? null,
      } as ConversationSummary
    }),
  )

  // Most recently active conversation first.
  return summaries.sort((a, b) => {
    const at = a.lastMessageAt || a.createdAt
    const bt = b.lastMessageAt || b.createdAt
    return new Date(bt).getTime() - new Date(at).getTime()
  })
}

export async function fetchConversationById(id: string): Promise<Conversation | null> {
  const { data, error } = await supabase.from('conversations').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? mapConversation(data) : null
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapMessage)
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string,
): Promise<Message> {
  // Computed here (not trusted from the caller) so the stored flag always reflects
  // the actual message text, and both participants see the same warning on it.
  const { flagged, reasons } = scanMessage(body)
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body,
      flagged,
      flag_reasons: reasons,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapMessage(data)
}

// Live-updates the open chat thread. Call the returned function on unmount to
// avoid leaking the socket subscription.
export function subscribeToMessages(
  conversationId: string,
  onInsert: (message: Message) => void,
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`messages-${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onInsert(mapMessage(payload.new)),
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
