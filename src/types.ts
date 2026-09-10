export type Category =
  | 'Mobiles'
  | 'Vehicles'
  | 'Furniture'
  | 'Appliances'
  | 'Electronics'
  | 'Fashion'
  | 'Books'
  | 'Sports'

export interface Listing {
  id: string
  ownerId: string
  title: string
  price: number
  category: Category
  subCategory: string | null
  condition: string
  description: string | null
  city: string | null
  location: string
  distanceKm: number
  verified: boolean
  escrow: boolean
  emoji: string
  bg: string
  photoUrls: string[]
  // Null for listings created before feature/mandatory-video -- new listings always
  // have one (enforced in the Sell wizard, not at the database level; see
  // video_upload_schema.sql for why).
  videoUrl: string | null
  status: 'active' | 'sold' | 'removed'
  createdAt: string
  // Approximate area-level coordinates resolved from `location` (see
  // lib/geocoding.ts) — null for listings created before this feature or
  // where geocoding couldn't resolve the text. Powers the interactive map
  // on ListingDetail; deliberately not precise enough to be a street address.
  latitude: number | null
  longitude: number | null
}

// Shape the Sell wizard collects and hands to lib/listings.ts createListing().
// A narrower type than Listing since fields like id/status/createdAt are server-assigned.
export interface NewListingInput {
  title: string
  price: number
  category: Category
  subCategory?: string
  condition: string
  description?: string
  city?: string
  location?: string
  latitude?: number | null
  longitude?: number | null
}

export interface Conversation {
  id: string
  listingId: string
  buyerId: string
  sellerId: string
  createdAt: string
}

export interface Message {
  id: string
  conversationId: string
  senderId: string
  body: string
  createdAt: string
  flagged: boolean
  flagReasons: string[]
}

// A conversation enriched with listing + last-message info, used to render the inbox list.
export interface ConversationSummary extends Conversation {
  listingTitle: string
  listingPrice: number
  listingEmoji: string
  listingPhotoUrl: string | null
  otherPartyId: string
  lastMessageBody: string | null
  lastMessageAt: string | null
}

export type ChatOfferStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'consumed'
export type ChatOfferMadeBy = 'buyer' | 'seller'

// A proposed price inside a chat thread — from either side, since either
// party can start or counter a negotiation. Rendered inline in the message
// timeline in Messages.tsx.
export interface ChatOffer {
  id: string
  conversationId: string
  listingId: string
  buyerId: string
  sellerId: string
  amount: number
  status: ChatOfferStatus
  // Who proposed THIS specific amount — the other party is the one who can
  // accept/decline/counter it; this party can only withdraw it.
  offeredBy: ChatOfferMadeBy
  // Set once this offer has been countered — points at the new offer row
  // that replaced it, so the UI can render a negotiation history/chain.
  supersededBy: string | null
  createdAt: string
  updatedAt: string
}

export type VaultOrderStatus = 'funded' | 'completed' | 'cancelled'

// Represents one "Buy with Vault" purchase attempt. handoverOtp is deliberately NOT a
// field here — it's never fetched as part of a normal row read (the DB revokes
// column-level access to it for everyone but the SECURITY DEFINER functions in
// supabase/vault_schema.sql). It only ever appears via VaultOrderWithOtp, returned
// directly from createVaultOrder/getHandoverOtp.
export interface VaultOrder {
  id: string
  listingId: string
  buyerId: string
  sellerId: string
  amount: number
  status: VaultOrderStatus
  createdAt: string
  completedAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  // Only meaningful once status === 'cancelled'. refundAmount is null until then;
  // deductedFee defaults to 0 and only becomes non-zero if a delivery rider had
  // already been arranged for this order at cancellation time.
  refundAmount: number | null
  deductedFee: number
  // Set once cancel-vault-order-and-refund's Razorpay call actually succeeds --
  // distinct from refundAmount, which is just the *computed* amount and gets set
  // immediately on cancellation regardless of whether the real refund went through.
  refundProcessedAt: string | null
  // Null for orders created before the Razorpay integration (or in any environment
  // still running the mocked Vault) -- there's no real payment behind those, so
  // "refund processing" would never resolve for them. Non-null means a real payment
  // exists and refundProcessedAt is meaningful to wait on.
  razorpayPaymentId: string | null
  listingTitle?: string
  listingEmoji?: string
  listingPhotoUrl?: string | null
  // Area/city text from the listing itself (e.g. "Rohini, Delhi") -- not the
  // handover meetup spot, which is a separate, more specific location. Used on the
  // receipt/transaction report so it shows where the item was listed from, not just
  // its name and price.
  listingLocation?: string | null
  // True when the listing is genuinely gone from view (moderator-removed, or its
  // live row is otherwise unavailable) -- false for the ordinary 'sold' end state,
  // so the UI can tell "this sold fine" apart from "this got taken down".
  listingRemoved?: boolean
}

export interface VaultOrderWithOtp extends VaultOrder {
  handoverOtp: string
}

export type DeliveryStatus = 'assigned' | 'delivered' | 'cancelled'
export type DeliveryPartner = 'Rapido' | 'Uber' | 'Dunzo'

export interface Delivery {
  id: string
  vaultOrderId: string
  buyerId: string
  sellerId: string
  partner: DeliveryPartner
  etaMinutes: number
  distanceKm: number
  fee: number
  status: DeliveryStatus
  createdAt: string
  deliveredAt: string | null
}

export interface Rating {
  id: string
  vaultOrderId: string
  raterId: string
  ratedUserId: string
  stars: number
  comment: string | null
  createdAt: string
}
export type NotificationType =
  | 'message'
  | 'vault_funded'
  | 'vault_completed'
  | 'vault_cancelled'
  | 'report_reviewed'
  | 'report_dismissed'
  | 'price_drop'

export interface AppNotification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string | null
  link: string | null
  read: boolean
  createdAt: string
}

export interface User {
  name: string
  city: string
  joined: string
  trustScore: number
  rating: number
  verified: boolean
  completedSaudas: number
  activeListings: number
  listingCap: number
  savedItems: number
}