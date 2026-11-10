import { useEffect, useState, useCallback } from 'react'

// Not every browser exposes the Network Information API (Safari/iOS never
// has), so this is deliberately typed as `any` and every read is guarded --
// treat its absence as "unknown", never as "fast".
function getConnection(): any {
  if (typeof navigator === 'undefined') return null
  return (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection || null
}

const STORAGE_KEY = 'e-sauda:lite-mode'

// True when the browser itself reports a slow link (2G/slow-2g) or the user
// has Data Saver turned on at the OS/browser level. This is what auto-enables
// Lite mode the first time someone visits on bad network -- see below.
function isSlowConnection(): boolean {
  const conn = getConnection()
  if (!conn) return false
  if (conn.saveData) return true
  if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') return true
  return false
}

// Drives the site's "Lite mode": while it's on, LazyImage (see
// components/LazyImage.tsx) shows plain grey/blank placeholders instead of
// fetching real photos, and video elements skip preloading. Nothing about
// buying, selling, chatting, or any other feature depends on images actually
// having loaded, so the app stays fully usable -- just visually bare, like an
// unstyled HTML page -- for anyone on a slow or metered connection.
//
// Three ways this turns on:
//  1. The browser's own Network Information API reports a slow/data-saver
//     connection (most Android/Chrome users).
//  2. The person flips it on manually from the Footer -- for Safari/iOS and
//     anyone who just wants to save data regardless of what the browser
//     reports (the API above is unavailable there).
//  3. It was already on from a previous visit (remembered in localStorage).
export function useNetworkStatus() {
  const [liteMode, setLiteModeState] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored !== null) return stored === '1'
    } catch {
      // localStorage can throw in private-browsing/sandboxed contexts --
      // fall through to the live network check instead of crashing.
    }
    return isSlowConnection()
  })

  useEffect(() => {
    const conn = getConnection()
    if (!conn || typeof conn.addEventListener !== 'function') return
    // If the person hasn't made an explicit choice yet, keep following the
    // browser's live connection quality (e.g. Lite mode auto-enables the
    // moment they walk into a dead zone, and can auto-clear once back on wifi).
    function onChange() {
      const hasExplicitChoice = localStorage.getItem(STORAGE_KEY) !== null
      if (!hasExplicitChoice) setLiteModeState(isSlowConnection())
    }
    conn.addEventListener('change', onChange)
    return () => conn.removeEventListener('change', onChange)
  }, [])

  const setLiteMode = useCallback((value: boolean) => {
    setLiteModeState(value)
    try {
      localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
    } catch {
      // Ignore -- worst case the choice doesn't persist across reloads.
    }
  }, [])

  return { liteMode, setLiteMode }
}
