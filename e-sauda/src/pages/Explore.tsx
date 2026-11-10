import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, ArrowUpRight, VolumeX, Volume2 } from 'lucide-react'
import { fetchListingsWithVideo } from '../lib/listings'
import { useSavedListings } from '../hooks/useSavedListings'
import { useAuth } from '../context/AuthContext'
import { Listing } from '../types'

// A single full-viewport-height video slide. Plays only while it's the
// "active" slide (see the IntersectionObserver in the parent) -- otherwise
// every video in the feed would be decoding/playing simultaneously, which
// is both a battery/bandwidth waste and makes the audio a mess.
function ExploreSlide({
  listing,
  active,
  muted,
  onToggleMute,
  saved,
  onToggleSaved,
}: {
  listing: Listing
  active: boolean
  muted: boolean
  onToggleMute: () => void
  saved: boolean
  onToggleSaved: () => void
}) {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (active) {
      video.currentTime = 0
      video.play().catch(() => {
        // Autoplay-with-sound can be blocked by the browser -- muted
        // autoplay (the default here) almost never is, so this mostly
        // matters right after the person taps unmute on a slide that
        // hasn't had a play() triggered by a gesture yet.
      })
    } else {
      video.pause()
    }
  }, [active])

  return (
    <div className="relative flex h-[calc(100vh-4.5rem)] w-full snap-start items-center justify-center bg-black">
      <video
        ref={videoRef}
        src={listing.videoUrl ?? undefined}
        className="h-full w-full object-contain"
        loop
        muted={muted}
        playsInline
        // Only the active slide should actually buffer video data -- every other
        // slide sitting in the DOM stays at preload="none" so a scroll through a
        // long Explore feed doesn't quietly download a dozen videos at once.
        preload={active ? 'auto' : 'none'}
        onClick={() => navigate(`/listing/${listing.id}`)}
      />

      {/* Gradient + info overlay, OLX/Shorts-style */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5">
        <div className="text-white">
          <p className="font-display text-xl font-semibold drop-shadow">
            ₹{listing.price.toLocaleString('en-IN')}
          </p>
          <p className="mt-1 max-w-xs truncate text-sm text-white/90">{listing.title}</p>
          <p className="mt-1 text-xs text-white/60">
            {listing.location || listing.city || ''}
          </p>
          <button
            onClick={() => navigate(`/listing/${listing.id}`)}
            className="mt-3 flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-cream-dark"
          >
            View details <ArrowUpRight size={13} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-4">
          <button
            onClick={onToggleSaved}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white"
            aria-label={saved ? 'Remove from saved' : 'Save listing'}
          >
            <Heart size={20} className={saved ? 'fill-clay text-clay' : ''} />
          </button>
          <button
            onClick={onToggleMute}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white"
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      </div>
    </div>
  )
}

// The Explore feed itself: a snap-scrolling column of full-height video
// slides, one per listing, mirroring YouTube Shorts/Instagram Reels. Clicking
// a slide (or its "View details" button) opens the exact same ListingDetail
// page as browsing normally -- Explore is just a different entry point into
// the same listings, not a separate data model.
export default function Explore() {
  const { user } = useAuth()
  const { savedIds, toggleSaved } = useSavedListings()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [muted, setMuted] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    let cancelled = false
    fetchListingsWithVideo()
      .then((data) => {
        if (!cancelled) setListings(data)
      })
      .catch(() => {
        if (!cancelled) setListings([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Tracks which slide is most visible in the scroll container and marks it
  // "active" -- that's what drives which single video actually plays.
  useEffect(() => {
    const root = containerRef.current
    if (!root || listings.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (mostVisible) {
          const idx = slideRefs.current.findIndex((el) => el === mostVisible.target)
          if (idx !== -1) setActiveIndex(idx)
        }
      },
      { root, threshold: [0.6] },
    )

    slideRefs.current.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [listings])

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4.5rem)] items-center justify-center bg-black">
        <p className="text-sm text-white/60">Loading videos…</p>
      </div>
    )
  }

  if (listings.length === 0) {
    return (
      <div className="flex h-[calc(100vh-4.5rem)] flex-col items-center justify-center gap-2 bg-black px-6 text-center">
        <p className="font-display text-xl text-white">No videos yet</p>
        <p className="text-sm text-white/50">Every new listing includes one — check back soon.</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="h-[calc(100vh-4.5rem)] snap-y snap-mandatory overflow-y-scroll"
    >
      {listings.map((listing, i) => (
        <div key={listing.id} ref={(el) => (slideRefs.current[i] = el)}>
          <ExploreSlide
            listing={listing}
            active={i === activeIndex}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
            saved={savedIds.has(listing.id)}
            onToggleSaved={() => (user ? toggleSaved(listing.id) : undefined)}
          />
        </div>
      ))}
    </div>
  )
}
