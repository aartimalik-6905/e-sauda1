import { useEffect, useState } from 'react'
import { getCurrentLocation } from '../lib/rideLinks'

export type UserLocationState = {
  coords: { lat: number; lng: number } | null
  // 'idle' while the browser prompt hasn't resolved yet, 'granted' once we have a
  // position, 'denied' if the person said no or geolocation isn't available at all.
  status: 'idle' | 'granted' | 'denied'
}

// Module-level cache so every ListingCard/ListingDetail on a page doesn't each
// trigger their own browser permission prompt / GPS fix -- the first component that
// mounts resolves it once, and every other subscriber gets the same result.
let cached: { lat: number; lng: number } | null = null
let inFlight: Promise<{ lat: number; lng: number } | null> | null = null
const subscribers = new Set<(coords: { lat: number; lng: number } | null) => void>()

function resolveLocation(): Promise<{ lat: number; lng: number } | null> {
  if (cached) return Promise.resolve(cached)
  if (!inFlight) {
    inFlight = getCurrentLocation()
      .then((point) => {
        cached = point
        subscribers.forEach((fn) => fn(point))
        return point
      })
      .catch(() => {
        // Permission denied, unsupported browser, or a timeout -- listings simply
        // fall back to showing no distance rather than blocking the page or
        // nagging with a retry loop.
        subscribers.forEach((fn) => fn(null))
        return null
      })
  }
  return inFlight
}

// Silently attempts to get the buyer's live location (no visible prompt/error UI of
// its own -- callers that get `coords: null` back just don't show a distance, the
// same as today's UI when it doesn't know one). Only ever asks for permission once
// per page load thanks to the module-level cache above.
export function useUserLocation(): UserLocationState {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(cached)
  const [status, setStatus] = useState<UserLocationState['status']>(cached ? 'granted' : 'idle')

  useEffect(() => {
    if (cached) {
      setCoords(cached)
      setStatus('granted')
      return
    }
    let mounted = true
    function onUpdate(point: { lat: number; lng: number } | null) {
      if (!mounted) return
      setCoords(point)
      setStatus(point ? 'granted' : 'denied')
    }
    subscribers.add(onUpdate)
    resolveLocation().then(onUpdate)
    return () => {
      mounted = false
      subscribers.delete(onUpdate)
    }
  }, [])

  return { coords, status }
}
