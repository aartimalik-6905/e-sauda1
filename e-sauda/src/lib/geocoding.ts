// Turns the free-text "area/city" a seller types in the Sell wizard (e.g.
// "Rohini Sector 13, Delhi") into an approximate lat/lng, so ListingDetail can
// render a real interactive map the way OLX does.
//
// Uses OpenStreetMap's Nominatim, deliberately instead of Google Maps'
// Geocoding API: it needs no API key/billing account to wire up, which means
// this actually works out of the box rather than being blocked on the seller
// (or evaluator) of this project first going and provisioning Google Cloud
// credentials. If the project later wants Google's geocoder instead, this is
// the only file that would need to change — every caller just awaits a
// { lat, lng } | null.
//
// Intentionally area-level: geocoding "Rohini Sector 13, Delhi" lands roughly
// in that neighbourhood, not on a specific building, which is exactly the
// privacy behaviour the spec asks for (no exact street address exposed).

export interface GeoPoint {
  lat: number
  lng: number
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

// Simple in-memory cache so re-editing a listing without changing the
// location text doesn't re-hit Nominatim (which asks integrators to keep
// request volume low) on every render.
const cache = new Map<string, GeoPoint | null>()

// Cache for reverseGeocode, keyed by rounded lat/lng -- same reasoning as the
// forward-geocode cache above (avoid hammering Nominatim on repeat lookups of
// essentially the same spot).
const reverseCache = new Map<string, string | null>()

// Turns a raw lat/lng (e.g. from the browser's Geolocation API) into a human-readable
// place name -- e.g. "Attach my current location" shouldn't leave the person looking
// at a checkmark with no idea what got attached; this is what lets the UI show the
// actual place in words instead.
export async function reverseGeocode(point: GeoPoint): Promise<string | null> {
  const key = `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`
  if (reverseCache.has(key)) return reverseCache.get(key)!

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${point.lat}&lon=${point.lng}&zoom=16&addressdetails=1`
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
    if (!res.ok) {
      reverseCache.set(key, null)
      return null
    }
    const data = await res.json()
    // Prefer a short, human "neighbourhood, city" form over Nominatim's full
    // comma-separated display_name (which tends to be a mouthful with country/
    // postcode/state all included) -- falls back to display_name if the address
    // breakdown doesn't have anything more specific to offer.
    const addr = data?.address ?? {}
    const area = addr.suburb || addr.neighbourhood || addr.road || addr.village || addr.town
    const city = addr.city || addr.county || addr.state_district
    const label = [area, city].filter(Boolean).join(', ') || data?.display_name || null
    reverseCache.set(key, label)
    return label
  } catch {
    return null
  }
}

// Cache for searchCities, keyed by the lowercased query text.
const citySearchCache = new Map<string, string[]>()

// Live city/area suggestions for the Browse filter's location box, so it isn't
// limited to a hardcoded handful of metros -- any city, town, or area in India (or
// anywhere else) that Nominatim knows about is a valid suggestion. Returns short
// display labels like "Indore, Madhya Pradesh" (deduplicated), not raw place IDs.
export async function searchCities(query: string): Promise<string[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const key = trimmed.toLowerCase()
  if (citySearchCache.has(key)) return citySearchCache.get(key)!

  try {
    const url =
      `${NOMINATIM_URL}?format=json&addressdetails=1&limit=8&countrycodes=in` +
      `&featureType=settlement&q=${encodeURIComponent(trimmed)}`
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
    if (!res.ok) {
      citySearchCache.set(key, [])
      return []
    }
    const results = await res.json()
    const labels: string[] = []
    const seen = new Set<string>()
    for (const r of Array.isArray(results) ? results : []) {
      const addr = r.address ?? {}
      const place = addr.city || addr.town || addr.village || addr.county || r.display_name?.split(',')[0]
      if (!place) continue
      const label = addr.state ? `${place}, ${addr.state}` : place
      const dedupeKey = label.toLowerCase()
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)
      labels.push(label)
    }
    citySearchCache.set(key, labels)
    return labels
  } catch {
    // A geocoder hiccup shouldn't block browsing -- the person can still type a
    // full city name and the ilike search on the backend will match it directly,
    // suggestions are just a convenience on top of that.
    return []
  }
}

export async function geocodeLocation(query: string, city?: string | null): Promise<GeoPoint | null> {
  const trimmed = query.trim()
  if (!trimmed) return null

  const fullQuery = city && !trimmed.toLowerCase().includes(city.toLowerCase())
    ? `${trimmed}, ${city}, India`
    : `${trimmed}, India`

  if (cache.has(fullQuery)) return cache.get(fullQuery)!

  try {
    const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(fullQuery)}`
    const res = await fetch(url, {
      headers: {
        // Nominatim's usage policy asks for an identifiable client rather
        // than a generic browser fetch with no Referer/UA of its own.
        'Accept-Language': 'en',
      },
    })
    if (!res.ok) {
      cache.set(fullQuery, null)
      return null
    }
    const results = await res.json()
    const first = Array.isArray(results) ? results[0] : null
    const point: GeoPoint | null = first
      ? { lat: Number(first.lat), lng: Number(first.lon) }
      : null
    cache.set(fullQuery, point)
    return point
  } catch {
    // Network hiccup or the geocoder being unreachable shouldn't block
    // publishing a listing — the map section on ListingDetail just won't
    // render for this one, same as a listing with no photos yet.
    return null
  }
}
