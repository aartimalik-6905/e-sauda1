import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Trash2, Package, CheckCircle, RotateCcw } from 'lucide-react'
import Reveal from '../components/Reveal'
import { useAuth } from '../context/AuthContext'
import { fetchUserListings, deleteListing, markListingSold, relistListing } from '../lib/listings'
import { Listing } from '../types'

const statusStyles: Record<Listing['status'], string> = {
  active: 'bg-emerald-500/10 text-emerald-400',
  sold: 'bg-ink/5 text-ink/60',
  removed: 'bg-red-500/10 text-red-400',
}

// The one place a seller can see everything they've ever posted, regardless of
// status, and get to its edit page -- previously Profile only showed a bare count
// ("Active listings: 1") with nothing to click through to.
export default function MyListings() {
  const { user } = useAuth()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [statusChangingId, setStatusChangingId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    fetchUserListings(user.id)
      .then(setListings)
      .catch((err) => setError(err.message || 'Could not load your listings'))
      .finally(() => setLoading(false))
  }, [user])

  async function handleDelete(listing: Listing) {
    if (!confirm(`Delete "${listing.title}"? This can't be undone.`)) return
    setDeletingId(listing.id)
    try {
      await deleteListing(listing.id)
      setListings((prev) => prev.filter((l) => l.id !== listing.id))
    } catch (err: any) {
      setError(err.message || 'Could not delete this listing')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleMarkSold(listing: Listing) {
    setStatusChangingId(listing.id)
    try {
      await markListingSold(listing.id)
      setListings((prev) => prev.map((l) => (l.id === listing.id ? { ...l, status: 'sold' } : l)))
    } catch (err: any) {
      setError(err.message || 'Could not update this listing')
    } finally {
      setStatusChangingId(null)
    }
  }

  async function handleRelist(listing: Listing) {
    setStatusChangingId(listing.id)
    try {
      await relistListing(listing.id)
      setListings((prev) => prev.map((l) => (l.id === listing.id ? { ...l, status: 'active' } : l)))
    } catch (err: any) {
      setError(err.message || 'Could not update this listing')
    } finally {
      setStatusChangingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Reveal contentClassName="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">My listings</h1>
        <Link to="/sell" className="rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-cream hover:bg-forest-light">
          + Sell something
        </Link>
      </Reveal>

      {error && <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}

      <div className="mt-6 space-y-3">
        {loading ? (
          [...Array(3)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl2 bg-cream-dark" />)
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl2 border border-line/5 bg-surface py-16 text-center">
            <Package size={28} className="text-ink/25" />
            <p className="mt-3 text-sm text-ink/50">You haven't posted anything yet.</p>
            <Link to="/sell" className="mt-4 text-sm font-medium text-clay hover:underline">
              Post your first listing
            </Link>
          </div>
        ) : (
          listings.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-4 rounded-xl2 border border-line/5 bg-surface p-4">
              <Link
                to={`/listing/${l.id}`}
                className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg text-2xl ${l.bg}`}
              >
                {l.photoUrls?.length > 0 ? (
                  <img src={l.photoUrls[0]} alt="" className="h-full w-full object-cover" />
                ) : (
                  l.emoji
                )}
              </Link>

              <div className="min-w-0 flex-1">
                <Link to={`/listing/${l.id}`} className="truncate font-medium text-ink hover:underline">
                  {l.title}
                </Link>
                <p className="mt-0.5 text-sm text-ink/60">₹{l.price.toLocaleString('en-IN')}</p>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusStyles[l.status]}`}>
                  {l.status}
                </span>
              </div>

              <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
                {l.status === 'active' && (
                  <>
                    <Link
                      to={`/listing/${l.id}/edit`}
                      className="flex items-center gap-1.5 rounded-full border border-line/10 bg-surface px-3 py-1.5 text-xs font-semibold text-ink/70 hover:bg-cream-dark"
                    >
                      <Pencil size={12} /> Edit
                    </Link>
                    <button
                      onClick={() => handleMarkSold(l)}
                      disabled={statusChangingId === l.id}
                      className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      <CheckCircle size={12} /> Mark as sold
                    </button>
                  </>
                )}
                {l.status === 'sold' && (
                  <button
                    onClick={() => handleRelist(l)}
                    disabled={statusChangingId === l.id}
                    className="flex items-center gap-1.5 rounded-full border border-line/10 bg-surface px-3 py-1.5 text-xs font-semibold text-ink/70 hover:bg-cream-dark disabled:opacity-50"
                  >
                    <RotateCcw size={12} /> Relist
                  </button>
                )}
                <button
                  onClick={() => handleDelete(l)}
                  disabled={deletingId === l.id}
                  className="flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
