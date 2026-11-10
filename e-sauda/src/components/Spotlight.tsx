import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'

export interface SpotlightSlide {
  index: string
  title: string
  desc: string
  icon: LucideIcon
}

const AUTO_ADVANCE_MS = 4500

/**
 * The signature motion piece: a numbered, auto-advancing carousel with
 * crossfading title/description/icon and a progress-filled index rail —
 * modelled on the (01)(02)(03) pagination + crossfade pattern from the
 * reference. One bold, orchestrated moment rather than scattered effects
 * elsewhere on the page.
 */
export default function Spotlight({ slides }: { slides: SpotlightSlide[] }) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (paused) return
    timerRef.current = setInterval(() => {
      setActive((i) => (i + 1) % slides.length)
    }, AUTO_ADVANCE_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [paused, slides.length])

  const slide = slides[active]

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative overflow-hidden rounded-xl2 border border-line/10 bg-cream-dark"
    >
      {/* Index rail */}
      <div className="flex items-center justify-between border-b border-line/10 px-6 py-3.5 sm:px-8">
        <p className="eyebrow">(How a deal works)</p>
        <div className="flex items-center gap-5">
          {slides.map((s, i) => (
            <button
              key={s.index}
              onClick={() => setActive(i)}
              className={`tab-index relative pb-1 ${i === active ? 'active' : ''}`}
              aria-label={`Go to step ${s.index}`}
            >
              ({s.index})
              {i === active && (
                <motion.span
                  layoutId="spotlight-underline"
                  className="absolute inset-x-0 -bottom-px h-px bg-clay"
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Crossfading content */}
      <div className="relative min-h-[10rem] px-6 py-8 sm:px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.index}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-1 items-center gap-6 sm:grid-cols-[auto_1fr]"
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface text-clay">
              <slide.icon size={24} strokeWidth={1.5} />
            </span>
            <div>
              <h3 className="font-display text-2xl font-extrabold leading-tight text-ink sm:text-3xl">
                {slide.title}
              </h3>
              <p className="mt-2 max-w-lg text-sm text-ink/60">{slide.desc}</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress bar for the active slide, restarts each time active changes */}
      <div className="h-px w-full bg-line/10">
        <motion.div
          key={active + (paused ? '-paused' : '')}
          className="h-full bg-clay"
          initial={{ width: '0%' }}
          animate={{ width: paused ? undefined : '100%' }}
          transition={{ duration: AUTO_ADVANCE_MS / 1000, ease: 'linear' }}
        />
      </div>
    </div>
  )
}