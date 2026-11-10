import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchSavedListingIds, saveListing, unsaveListing } from '../lib/savedItems'

// Centralizes saved-listing state so Browse/Home/SellerProfile don't each carry their
// own copy of the same fetch-then-toggle logic (and so a save on one page is
// consistent with what the others would show, since they all read via this hook).
export function useSavedListings() {
  const { user } = useAuth()
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setSavedIds(new Set())
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetchSavedListingIds(user.id)
      .then((ids) => {
        if (!cancelled) setSavedIds(ids)
      })
      .catch(() => {
        if (!cancelled) setSavedIds(new Set())
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const toggleSaved = useCallback(
    async (listingId: string) => {
      if (!user) return // ListingCard only calls this when logged in; safety net regardless
      const alreadySaved = savedIds.has(listingId)

      // Optimistic update so the heart responds instantly.
      setSavedIds((prev) => {
        const next = new Set(prev)
        alreadySaved ? next.delete(listingId) : next.add(listingId)
        return next
      })

      try {
        if (alreadySaved) {
          await unsaveListing(user.id, listingId)
        } else {
          await saveListing(user.id, listingId)
        }
      } catch {
        // Roll back on failure so the heart doesn't lie about what's actually saved.
        setSavedIds((prev) => {
          const next = new Set(prev)
          alreadySaved ? next.add(listingId) : next.delete(listingId)
          return next
        })
      }
    },
    [user, savedIds],
  )

  return { savedIds, toggleSaved, loading }
}
