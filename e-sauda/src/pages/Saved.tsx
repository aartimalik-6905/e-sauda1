import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import Reveal from '../components/Reveal'
import { useAuth } from '../context/AuthContext'
import { fetchSavedListings, unsaveListing } from '../lib/savedItems'
import { Listing } from '../types'
import ListingCard from '../components/ListingCard'

export default function Saved() {
  const { user } = useAuth()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)

  function load() {
    if (!user) return
    setLoading(true)
    fetchSavedListings(user.id)
      .then(setListings)
      .catch(() => setListings([]))
      .finally(() => setLoading(false))
  }

  useEffect(load, [user])

  // Removing from this page unsaves it for real (rather than just hiding it), since
  // that's clearly what tapping the heart on your own wishlist means.
  async function handleToggle(listingId: string) {
    if (!user) return
    setListings((prev) => prev.filter((l) => l.id !== listingId))
    try {
      await unsaveListing(user.id, listingId)
    } catch {
      load() // something went wrong — resync with the server instead of leaving stale state
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <Reveal>
        <h1 className="font-display text-3xl font-semibold">Saved</h1>
        <p className="mt-1 text-sm text-ink/60">Listings you've saved to look at again.</p>
      </Reveal>

      {loading ? (
        <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl2 bg-cream-dark" />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center rounded-xl2 border border-dashed border-line/15 py-20 text-center">
          <Heart size={32} className="text-ink/25" />
          <p className="mt-4 font-medium text-ink">Nothing saved yet.</p>
          <p className="text-sm text-ink/50">Tap the ❤️ on any listing to keep it here.</p>
          <Link
            to="/browse"
            className="mt-4 rounded-full border border-line/10 bg-surface px-5 py-2.5 text-sm font-semibold text-ink hover:bg-cream-dark"
          >
            Browse listings
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-4">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} saved onToggleSaved={handleToggle} />
          ))}
        </div>
      )}
    </div>
  )
}
