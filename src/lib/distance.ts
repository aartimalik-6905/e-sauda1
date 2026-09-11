// Straight-line ("as the crow flies") distance between two lat/lng points, in
// kilometers, via the Haversine formula. Good enough for "X km away" on a listing
// card -- nobody expects driving-distance precision there, and that would need a
// routing API (with its own key/quota) instead of simple geometry.
export function haversineKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const R = 6371 // Earth's mean radius in km
  const dLat = toRad(to.lat - from.lat)
  const dLng = toRad(to.lng - from.lng)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

// Formats a km distance the way the rest of the app already does ("3km away",
// "0.4km away") -- under 10km shows one decimal place since the whole-number
// rounding would otherwise make every nearby listing look identically "0km" or
// "1km" away.
export function formatDistanceKm(km: number): string {
  if (km < 10) return `${km.toFixed(1)}km`
  return `${Math.round(km)}km`
}
