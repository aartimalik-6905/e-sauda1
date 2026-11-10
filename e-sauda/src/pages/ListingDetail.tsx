import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ShieldCheck, MapPin, MessageCircle, AlertTriangle } from 'lucide-react'
import { fetchListingById } from '../lib/listings'
import { fetchRecommendedListings } from '../lib/recommendations'
import { getOrCreateConversation } from '../lib/chat'
import { fetchMyAcceptedOffer } from '../lib/chatOffers'
import { useAuth } from '../context/AuthContext'
import { useSavedListings } from '../hooks/useSavedListings'
import { useUserLocation } from '../hooks/useUserLocation'
import { haversineKm, formatDistanceKm } from '../lib/distance'
import { Listing, ChatOffer } from '../types'
import ReportButton from '../components/ReportButton'
import ListingCard from '../components/ListingCard'
import ListingMap from '../components/ListingMap'
import LazyImage from '../components/LazyImage'
import { useNetworkStatusContext } from '../context/NetworkStatusContext'

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { savedIds, toggleSaved } = useSavedListings()
  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activePhoto, setActivePhoto] = useState(0)
  const [startingChat, setStartingChat] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [recommended, setRecommended] = useState<Listing[]>([])
  const [acceptedOffer, setAcceptedOffer] = useState<ChatOffer | null>(null)

  useEffect(() => {
    if (!user || !listing) {
      setAcceptedOffer(null)
      return
    }
    fetchMyAcceptedOffer(listing.id, user.id)
      .then(setAcceptedOffer)
      .catch(() => setAcceptedOffer(null))
  }, [listing?.id, user?.id])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetchListingById(id)
      .then((data) => {
        if (!data) setNotFound(true)
        setListing(data)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  // Runs after the main listing loads (not in parallel with it) since it needs the
  // listing's category to know what to look for. Failing quietly to an empty list is
  // fine here — this section is a bonus, not core to viewing the listing.
  useEffect(() => {
    if (!listing) {
      setRecommended([])
      return
    }
    let cancelled = false
    fetchRecommendedListings(listing)
      .then((results) => {
        if (!cancelled) setRecommended(results)
      })
      .catch(() => {
        if (!cancelled) setRecommended([])
      })
    return () => {
      cancelled = true
    }
  }, [listing?.id, listing?.category])

  const { liteMode } = useNetworkStatusContext()

  const isOwner = !!user && !!listing && user.id === listing.ownerId

  // Same real-distance computation as ListingCard -- see its comment for why this
  // replaces the always-0 distanceKm field instead of just reading it.
  const { coords: myCoords } = useUserLocation()
  const distanceLabel =
    myCoords && listing?.latitude != null && listing?.longitude != null
      ? formatDistanceKm(haversineKm(myCoords, { lat: listing.latitude, lng: listing.longitude }))
      : null

  async function handleChat() {
    if (!user) {
      navigate('/login')
      return
    }
    if (!listing) return
    setStartingChat(true)
    setChatError(null)
    try {
      const conversation = await getOrCreateConversation(listing.id, user.id, listing.ownerId)
      navigate(`/messages/${conversation.id}`)
    } catch (err: any) {
      setChatError(err.message || 'Could not start a chat. Try again.')
    } finally {
      setStartingChat(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="h-96 animate-pulse rounded-xl2 bg-cream-dark" />
          <div className="space-y-4">
            <div className="h-8 w-2/3 animate-pulse rounded bg-cream-dark" />
            <div className="h-6 w-1/3 animate-pulse rounded bg-cream-dark" />
            <div className="h-24 animate-pulse rounded bg-cream-dark" />
          </div>
        </div>
      </div>
    )
  }

  if (notFound || !listing) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <p className="font-display text-2xl font-semibold">Listing not found</p>
        <p className="mt-2 text-sm text-ink/60">It may have been removed or sold.</p>
        <Link to="/browse" className="mt-6 inline-block rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream">
          Back to Browse
        </Link>
      </div>
    )
  }

  const photos = listing.photoUrls ?? []

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        <div>
          <div className={`flex h-96 items-center justify-center overflow-hidden rounded-xl2 text-8xl ${listing.bg}`}>
            {photos.length > 0 ? (
              // eager: the main photo is above the fold on this page, so it
              // should load immediately rather than waiting to scroll into view --
              // Lite mode (slow connections) still shows a "tap to load" block for it.
              <LazyImage src={photos[activePhoto]} alt={listing.title} className="h-full w-full" eager />
            ) : (
              <span>{listing.emoji}</span>
            )}
          </div>
          {photos.length > 1 && (
            <div className="mt-3 flex gap-2">
              {photos.map((p, i) => (
                <button
                  key={p}
                  onClick={() => setActivePhoto(i)}
                  className={`h-16 w-16 overflow-hidden rounded-lg border-2 ${
                    i === activePhoto ? 'border-clay' : 'border-transparent'
                  }`}
                >
                  <LazyImage src={p} alt="" className="h-full w-full" />
                </button>
              ))}
            </div>
          )}

          {listing.videoUrl && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">Product video</p>
              {/* preload="none" on a slow/Lite-mode connection so opening this page
                  doesn't also start pulling down the video in the background --
                  it only downloads once the person actually presses play. */}
              <video
                src={listing.videoUrl}
                controls
                preload={liteMode ? 'none' : 'metadata'}
                className="mt-2 aspect-video w-full rounded-xl2 bg-black"
              />
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2">
            {listing.verified && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-400">
                <ShieldCheck size={11} /> Verified
              </span>
            )}
            <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-ink/60">
              {listing.status !== 'active' ? listing.status.toUpperCase() : listing.category}
            </span>
          </div>

          <h1 className="mt-4 font-display text-3xl font-semibold text-ink">{listing.title}</h1>
          <p className="mt-2 font-display text-2xl font-semibold text-clay">
            ₹{listing.price.toLocaleString('en-IN')}
          </p>

          <p className="mt-3 flex items-center gap-1 text-sm text-ink/60">
            <MapPin size={14} /> {listing.location || listing.city || 'Location not set'}
            {distanceLabel
              ? ` · ${distanceLabel} away`
              : !isOwner && ' · Enable location access to see distance'}
          </p>
          {listing.latitude !== null && listing.longitude !== null && (
            <div className="mt-3">
              <ListingMap lat={listing.latitude} lng={listing.longitude} label={listing.location || listing.city || listing.title} />
              <p className="mt-1.5 text-xs text-ink/40">
                Approximate area shown for privacy — agree the exact meeting spot with the seller in chat.
              </p>
            </div>
          )}
          {!isOwner && (
            <div className="mt-1 flex items-center gap-3">
              <Link to={`/seller/${listing.ownerId}`} className="text-sm text-clay hover:underline">
                View seller profile
              </Link>
              <ReportButton listingId={listing.id} reportedUserId={listing.ownerId} label="Report listing" />
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-surface p-3">
              <p className="text-xs text-ink/50">Condition</p>
              <p className="font-medium text-ink">{listing.condition}</p>
            </div>
            <div className="rounded-lg bg-surface p-3">
              <p className="text-xs text-ink/50">Category</p>
              <p className="font-medium text-ink">
                {listing.category}
                {listing.subCategory ? ` · ${listing.subCategory}` : ''}
              </p>
            </div>
          </div>

          {listing.description && (
            <div className="mt-6">
              <p className="text-sm font-semibold text-ink">Description</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink/70">{listing.description}</p>
            </div>
          )}

          {chatError && <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{chatError}</p>}

          <div className="mt-8">
            {isOwner ? (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-ink/5 p-4 text-sm text-ink/60">
                This is your own listing.
                <Link
                  to={`/listing/${listing.id}/edit`}
                  className="shrink-0 rounded-full border border-line/10 bg-surface px-4 py-2 text-xs font-semibold text-ink hover:bg-cream-dark"
                >
                  Edit listing
                </Link>
              </div>
            ) : listing.status !== 'active' ? (
              <div className="rounded-lg bg-ink/5 p-4 text-sm text-ink/60">
                This listing is no longer available.
              </div>
            ) : (
              <div>
                {acceptedOffer && (
                  <div className="mb-3 rounded-lg border border-forest/20 bg-forest/5 px-4 py-2.5 text-sm text-forest">
                    You and the seller agreed on{' '}
                    <strong>₹{acceptedOffer.amount.toLocaleString('en-IN')}</strong> instead of the listed
                    price. Pay this directly to the seller when you meet.
                  </div>
                )}
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleChat}
                    disabled={startingChat}
                    className="flex items-center gap-2 rounded-full border border-line/10 bg-surface px-6 py-3 text-sm font-semibold text-ink hover:bg-cream-dark disabled:opacity-50"
                  >
                    <MessageCircle size={16} />
                    {startingChat ? 'Starting chat…' : 'Chat with seller'}
                  </button>
                </div>
                <div className="mt-4 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-ink/70">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
                  <p>
                    Deal directly with the seller. Meet in a public place, check the item, and only
                    then pay. <strong>Never pay in advance</strong> or share an OTP.{' '}
                    <Link to="/safety" className="text-clay hover:underline">Safety tips</Link>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {recommended.length > 0 && (
          <div className="mt-12">
            <p className="font-display text-xl font-semibold text-ink">You might also need</p>
            <p className="mt-1 text-sm text-ink/50">
              Other active listings that often go with a {listing.category.toLowerCase()} purchase.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-4">
              {recommended.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  saved={savedIds.has(l.id)}
                  onToggleSaved={toggleSaved}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
