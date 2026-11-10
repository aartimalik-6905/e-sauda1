import { useEffect, useRef, useState } from 'react'
import { ImageOff, ImageDown } from 'lucide-react'
import { useNetworkStatusContext } from '../context/NetworkStatusContext'

interface LazyImageProps {
  src: string
  alt: string
  className?: string
  // Lets a slide-show/thumbnail strip (ListingDetail's main photo) force an
  // immediate load for the currently-active image even inside a lazy list.
  eager?: boolean
}

// Renders nothing but a plain grey box (no network request at all) until
// either: the image scrolls near the viewport (IntersectionObserver) AND
// Lite mode is off, or the person taps the box to load it anyway. This is
// what keeps the site usable -- pages render instantly and every button/link
// still works -- even on a connection too slow to actually fetch photos.
export default function LazyImage({ src, alt, className = '', eager = false }: LazyImageProps) {
  const { liteMode } = useNetworkStatusContext()
  const containerRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(eager)
  const [forceLoad, setForceLoad] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    if (inView) return
    const el = containerRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true) // no IO support -- fail open rather than never loading
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' }, // start fetching a little before it's actually visible
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [inView])

  // Reset load state if the image URL itself changes (e.g. swapping the
  // active photo in a gallery reuses the same LazyImage instance).
  useEffect(() => {
    setLoaded(false)
    setErrored(false)
  }, [src])

  const shouldFetch = (inView && !liteMode) || forceLoad

  return (
    <div ref={containerRef} className={`relative overflow-hidden bg-ink/10 ${className}`}>
      {shouldFetch && !errored && (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={`h-full w-full object-cover transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* Placeholder: shown until the real image has loaded, on error, or
          whenever Lite mode is deliberately skipping the fetch. */}
      {(!shouldFetch || !loaded) && !errored && (
        <button
          type="button"
          onClick={(e) => {
            if (!shouldFetch) {
              e.preventDefault()
              e.stopPropagation()
              setForceLoad(true)
            }
          }}
          className={`absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-ink/10 text-ink/30 ${
            shouldFetch ? 'cursor-default' : 'cursor-pointer'
          }`}
          aria-label={shouldFetch ? undefined : 'Tap to load image'}
          tabIndex={shouldFetch ? -1 : 0}
        >
          <ImageDown size={20} strokeWidth={1.5} />
          {!shouldFetch && <span className="text-[10px] font-medium">Tap to load</span>}
        </button>
      )}

      {errored && (
        <div className="absolute inset-0 flex items-center justify-center bg-ink/10 text-ink/25">
          <ImageOff size={20} strokeWidth={1.5} />
        </div>
      )}
    </div>
  )
}
