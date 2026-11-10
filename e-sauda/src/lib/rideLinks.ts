// Uber's universal link format is real, public, documented, and needs no API key or
// partner approval -- https://developer.uber.com/docs/deep-linking. Opens the native
// app if installed, falls back to Uber's mobile web otherwise. This is genuinely
// functional today, unlike a "real" DigiLocker or Shiprocket integration which need
// an approved partner account first.
//
// Rapido has no equivalent publicly documented deep-link scheme (checked before
// building this -- nothing officially published, unlike Uber's). Rather than guess at
// an undocumented URL and risk it silently breaking, getRapidoLink() just opens
// Rapido's site/app listing with no prefill, and the UI is honest about that
// difference rather than implying both buttons do the same thing.

export function getCurrentLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Your browser doesn\'t support location access.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        // err.code 1 = permission denied, the overwhelmingly common case here.
        reject(
          new Error(
            err.code === 1
              ? 'Location access was denied. Allow location access in your browser to use this.'
              : 'Could not get your current location. Try again.',
          ),
        )
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  })
}

export function buildUberRideLink(
  pickup: { lat: number; lng: number },
  dropoff: { lat: number; lng: number },
  dropoffLabel: string,
): string {
  const params = new URLSearchParams({
    action: 'setPickup',
    'pickup[latitude]': String(pickup.lat),
    'pickup[longitude]': String(pickup.lng),
    'pickup[nickname]': 'Your location',
    'dropoff[latitude]': String(dropoff.lat),
    'dropoff[longitude]': String(dropoff.lng),
    'dropoff[nickname]': dropoffLabel,
  })
  return `https://m.uber.com/ul/?${params.toString()}`
}

// No prefill possible -- see the module comment above for why. Kept as a function
// (rather than a hardcoded link in the component) so if Rapido ever does publish a
// real deep-link scheme, there's exactly one place to add it.
export function getRapidoLink(): string {
  return 'https://rapido.bike/'
}
