export type Category =
  | 'Mobiles'
  | 'Vehicles'
  | 'Furniture'
  | 'Appliances'
  | 'Electronics'
  | 'Fashion'
  | 'Books'
  | 'Sports'
  | 'Others'

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
  listingStatus: string | null
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

export interface Rating {
  id: string
  conversationId: string
  raterId: string
  ratedUserId: string
  stars: number
  comment: string | null
  createdAt: string
}
export type NotificationType =
  | 'message'
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