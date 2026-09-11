import { supabase } from './supabase'
import { invokeFunction } from './razorpay'
import { VaultOrder, VaultOrderWithOtp } from '../types'

function mapRow(row: any): VaultOrder {
  return {
    id: row.id,
    listingId: row.listing_id,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    amount: Number(row.amount),
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    cancelReason: row.cancel_reason,
    refundAmount: row.refund_amount !== null && row.refund_amount !== undefined ? Number(row.refund_amount) : null,
    deductedFee: Number(row.deducted_fee ?? 0),
    refundProcessedAt: row.refund_processed_at ?? null,
    razorpayPaymentId: row.razorpay_payment_id ?? null,
    // Prefer the live listing (so an edited title/photo shows up immediately);
    // fall back to the purchase-time snapshot for the rare case the live join comes
    // back null (see vault_listing_snapshot_schema.sql for why that could still
    // happen even with the RLS fix -- e.g. this row predates the backfill).
    listingTitle: row.listings?.title ?? row.listing_title_snapshot ?? undefined,
    listingEmoji: row.listings?.emoji ?? row.listing_emoji_snapshot ?? undefined,
    listingPhotoUrl: row.listings?.photo_urls?.[0] ?? row.listing_photo_url_snapshot ?? null,
    // Only ever comes from the live listing -- there's no snapshot column for this
    // one (it's shown alongside the title/photo, which do have snapshots, but isn't
    // essential enough on its own to warrant a schema change; if the live listing
    // is ever genuinely gone this just doesn't render on the receipt).
    listingLocation: row.listings?.location ?? null,
    // True only when the listing itself is actually gone from the buyer/seller's
    // reach (moderator-removed, or the live row is otherwise unavailable) -- not
    // merely 'sold', which is the normal end state for a completed purchase.
    listingRemoved: row.listings == null || row.listings?.status === 'removed',
  }
}

// NOTE on scope: everything below is real — real rows, real per-user access control
// enforced in Postgres (see supabase/vault_schema.sql), real state transitions. The
// only mocked part is the payment itself: creating a vault order doesn't call any
// payment gateway, it just writes a row. See the schema file for the full note.

// Called from the listing detail page's "Buy with Vault" button, after
// payWithRazorpay() (lib/razorpay.ts) has actually collected and verified payment --
// create_vault_order will reject this call if no matching verified payment exists
// for razorpayOrderId (see supabase/razorpay_schema.sql), so this can't be called
// successfully without a real payment happening first.
export async function createVaultOrder(listingId: string, razorpayOrderId: string): Promise<VaultOrderWithOtp> {
  const { data, error } = await supabase.rpc('create_vault_order', {
    p_listing_id: listingId,
    p_razorpay_order_id: razorpayOrderId,
  })
  if (error) throw error
  return { ...mapRow(data), handoverOtp: data.handover_otp }
}

// Lets the buyer look up the OTP again later (e.g. they closed the app before the
// meetup). Enforced server-side to only work for the buyer of a still-funded order.
export async function getHandoverOtp(orderId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_handover_otp', { p_order_id: orderId })
  if (error) throw error
  return data as string
}

// Seller submits the OTP the buyer read out in person. Wrong OTP, wrong caller, or an
// order that's already completed/cancelled all fail server-side with a clear message.
export async function confirmHandover(orderId: string, enteredOtp: string): Promise<VaultOrder> {
  const { data, error } = await supabase.rpc('confirm_handover', {
    p_order_id: orderId,
    p_entered_otp: enteredOtp,
  })
  if (error) throw error
  return mapRow(data)
}

export interface CancelResult {
  order: VaultOrder
  refunded: boolean
  refundFailed?: boolean
}

// Previously called the cancel_vault_order RPC directly -- that still runs (the Edge
// Function calls it internally, preserving every ownership/status check exactly as
// before), but now a real Razorpay refund for refund_amount happens too. See
// supabase/functions/cancel-vault-order-and-refund and RAZORPAY_SETUP.md's
// "what's still mocked" section, which this feature resolves.
export async function cancelVaultOrder(orderId: string, reason: string): Promise<CancelResult> {
  const data = await invokeFunction<{
    order: any
    refunded: boolean
    refundFailed?: boolean
    alreadyProcessed?: boolean
  }>('cancel-vault-order-and-refund', { orderId, reason })
  return { order: mapRow(data.order), refunded: data.refunded, refundFailed: data.refundFailed }
}

// handover_otp is intentionally absent from this column list — column-level SELECT on
// it is revoked for every client role in vault_schema.sql, so even asking for it here
// would just error. Only the RPC functions above can read or write it.
const SELECT_COLUMNS =
  'id, listing_id, buyer_id, seller_id, amount, status, created_at, completed_at, cancelled_at, cancel_reason, refund_amount, deducted_fee, refund_processed_at, razorpay_payment_id, listing_title_snapshot, listing_emoji_snapshot, listing_photo_url_snapshot, listings(title, emoji, photo_urls, status, location)'

export async function fetchMyPurchases(userId: string): Promise<VaultOrder[]> {
  const { data, error } = await supabase
    .from('vault_orders')
    .select(SELECT_COLUMNS)
    .eq('buyer_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapRow)
}

export async function fetchMySales(userId: string): Promise<VaultOrder[]> {
  const { data, error } = await supabase
    .from('vault_orders')
    .select(SELECT_COLUMNS)
    .eq('seller_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapRow)
}
