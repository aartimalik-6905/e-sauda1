import { supabase } from './supabase'
import { mapRow, escapeLike } from './listings'
import { Listing, Category } from '../types'
import { fetchSavedListings } from './savedItems'
import { complementaryKeywords, specificComplementaryTriggers } from '../data/recommendations'

// Called from the listing detail page. Looks up this listing's category (and, if its
// own title/sub-category matches a known specific trigger like "scooty" or "shirt", a
// more targeted list too) in the complementary-keyword map, then finds other active
// listings (excluding this one) whose title or sub-category matches any of those
// keywords. Returns [] rather than throwing when nothing matches -- this is a "nice to
// have" section, not something that should ever block the page from rendering.
export async function fetchRecommendedListings(listing: Listing, limit = 8): Promise<Listing[]> {
  const haystack = `${listing.title} ${listing.subCategory ?? ''}`.toLowerCase()

  const specificKeywords = specificComplementaryTriggers
    .filter((t) => t.matches.some((m) => haystack.includes(m)))
    .flatMap((t) => t.keywords)

  const keywords = Array.from(new Set([...specificKeywords, ...(complementaryKeywords[listing.category] ?? [])]))
  if (keywords.length === 0) return []

  const orClauses = keywords
    .flatMap((kw) => {
      const term = escapeLike(kw)
      return [`title.ilike.%${term}%`, `sub_category.ilike.%${term}%`]
    })
    .join(',')

  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('status', 'active')
    .neq('id', listing.id)
    .or(orClauses)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []).map(mapRow)
}
// Feature: wishlist-driven "Recommended for you". Unlike fetchRecommendedListings
// above (which looks at ONE listing's category/keywords for a "you might also
// need" rail), this looks at everything the user has SAVED and surfaces other
// active listings similar to their wishlist as a whole -- the more they save in
// a category, the more that category is weighted. Powers the Home page section.
//
// Never throws on an empty/failed wishlist lookup -- like the per-listing
// version, this is a nice-to-have rail, not something that should block Home
// from rendering if it can't be computed.
export async function fetchWishlistBasedRecommendations(
  userId: string,
  limit = 8,
): Promise<Listing[]> {
  const saved = await fetchSavedListings(userId)
  if (saved.length === 0) return []

  const savedIds = new Set(saved.map((l) => l.id))

  // Rank categories by how often they show up in the wishlist -- someone who's
  // saved three phones and one chair should see mostly phones recommended.
  const categoryCounts = new Map<Category, number>()
  const keywords = new Set<string>()
  for (const l of saved) {
    categoryCounts.set(l.category, (categoryCounts.get(l.category) ?? 0) + 1)
    if (l.subCategory) keywords.add(l.subCategory.toLowerCase())
    // A few loose keywords from each saved title too, so e.g. saving several
    // "iPhone" listings nudges toward other iPhone listings, not just Mobiles
    // in general.
    l.title
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3)
      .forEach((w) => keywords.add(w))
  }

  const topCategories = Array.from(categoryCounts.keys())
  if (topCategories.length === 0) return []

  // Over-fetch within the wishlist's categories, then rank client-side by a
  // combined category-weight + keyword-overlap score -- cheap to do given the
  // small result set, and avoids needing a bespoke ranked SQL query.
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('status', 'active')
    .in('category', topCategories)
    .order('created_at', { ascending: false })
    .limit(limit * 5)

  if (error) throw error

  const candidates = (data ?? [])
    .map(mapRow)
    .filter((l) => !savedIds.has(l.id) && l.ownerId !== userId)

  const scored = candidates.map((listing) => {
    const categoryWeight = categoryCounts.get(listing.category) ?? 0
    const haystack = `${listing.title} ${listing.subCategory ?? ''}`.toLowerCase()
    const keywordMatches = Array.from(keywords).filter((kw) => haystack.includes(kw)).length
    return { listing, score: categoryWeight * 2 + keywordMatches }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((s) => s.listing)
}
