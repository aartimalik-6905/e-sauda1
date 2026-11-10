import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Star, ShieldCheck, MapPin, Package } from 'lucide-react'
import { fetchPublicProfile, PublicProfile } from '../lib/profiles'
import { fetchUserListings } from '../lib/listings'
import { fetchRatingsForUser } from '../lib/ratings'
import { useAuth } from '../context/AuthContext'
import { useSavedListings } from '../hooks/useSavedListings'
import Reveal from '../components/Reveal'
import { Listing, Rating } from '../types'
import ListingCard from '../components/ListingCard'
import ReportButton from '../components/ReportButton'

export default function SellerProfile() {
  const { savedIds, toggleSaved } = useSavedListings()
  const { user } = useAuth()
  const { id } = useParams<{ id: string }>()
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [ratings, setRatings] = useState<Rating[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setNotFound(false)
    Promise.all([fetchPublicProfile(id), fetchUserListings(id), fetchRatingsForUser(id)])
      .then(([p, l, r]) => {
        if (!p) {
          setNotFound(true)
          return
        }
        setProfile(p)
        setListings(l.filter((item) => item.status === 'active'))
        setRatings(r)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="h-40 animate-pulse rounded-xl2 bg-cream-dark" />
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <p className="font-display text-2xl font-semibold">Seller not found</p>
        <Link to="/browse" className="mt-6 inline-block rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream">
          Back to Browse
        </Link>
      </div>
    )
  }

  const joinedLabel = new Date(profile.joinedAt).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Reveal className="rounded-xl2 bg-gradient-to-br from-clay/15 to-cream-dark p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-forest text-2xl font-semibold text-cream">
              {profile.displayName.charAt(0).toUpperCase()}
            </span>
            <div>
              <h1 className="font-display text-2xl font-semibold">{profile.displayName}</h1>
              <p className="flex items-center gap-1 text-sm text-ink/60">
                {profile.city && (
                  <>
                    <MapPin size={13} /> {profile.city} ·{' '}
                  </>
                )}
                Joined {joinedLabel}
              </p>
              <div className="mt-1 flex items-center gap-3 text-xs">
                <span className={profile.verified ? 'flex items-center gap-1 text-emerald-400' : 'text-amber-400'}>
                  {profile.verified && <ShieldCheck size={12} />}
                  {profile.verified ? 'Verified' : 'Not verified'}
                </span>
                {profile.ratingCount > 0 && (
                  <span className="flex items-center gap-1 text-ink/70">
                    <Star size={12} className="fill-amber-400 text-amber-400" />
                    {profile.ratingAvg?.toFixed(1)} ({profile.ratingCount})
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-ink/50">Trust score</p>
            <p className="font-display text-4xl font-semibold text-clay">{profile.trustScore}</p>
            {user && user.id !== profile.id && (
              <div className="mt-2">
                <ReportButton reportedUserId={profile.id} label="Report user" />
              </div>
            )}
          </div>
        </div>
      </Reveal>

      <h2 className="mt-8 font-display text-xl font-semibold">
        Active listings <span className="text-base font-normal text-ink/50">({listings.length})</span>
      </h2>
      {listings.length === 0 ? (
        <p className="mt-3 text-sm text-ink/50">Nothing listed right now.</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3">
          {listings.map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              saved={savedIds.has(l.id)}
              onToggleSaved={toggleSaved}
            />
          ))}
        </div>
      )}

      <h2 className="mt-10 font-display text-xl font-semibold">
        Reviews <span className="text-base font-normal text-ink/50">({ratings.length})</span>
      </h2>
      {ratings.length === 0 ? (
        <div className="mt-4 flex flex-col items-center rounded-xl2 border border-dashed border-line/15 py-12 text-center">
          <Package size={28} className="text-ink/25" />
          <p className="mt-3 text-sm text-ink/50">No reviews yet.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {ratings.map((r) => (
            <div key={r.id} className="rounded-xl2 border border-line/5 bg-surface p-4">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={14}
                    className={i < r.stars ? 'fill-amber-400 text-amber-400' : 'text-ink/10'}
                  />
                ))}
                <span className="ml-2 text-xs text-ink/40">
                  {new Date(r.createdAt).toLocaleDateString('en-IN')}
                </span>
              </div>
              {r.comment && <p className="mt-2 text-sm text-ink/70">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
