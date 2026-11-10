import { motion } from 'framer-motion'
import { ReactNode } from 'react'

/**
 * Curtain-style reveal used across every page for scroll-triggered entrances.
 *
 * Deliberately NOT an opacity fade-up. Content sits behind an
 * overflow-hidden mask and slides up into place from behind that edge, so it
 * arrives already in full focus, "uncovered" by the motion rather than
 * materializing out of nothing. This is the same wipe pattern the reference
 * video uses for its headline and image reveals.
 *
 * `className` vs `contentClassName`: `className` lands on the outer mask div --
 * right for sizing/spacing/background classes (mx-auto, max-w-*, p-8, rounded-xl2,
 * bg-gradient-*, margins), since those describe the Reveal's own box. It's the
 * WRONG place for classes meant to arrange multiple children relative to each
 * other (flex, grid, items-*, justify-*, gap-*) -- the outer div's only real DOM
 * child is the motion.div wrapper below it, so e.g. `flex justify-between` there
 * has no visible effect on the actual children inside, which still just stack
 * block-by-block with no flex/grid applied at all. Use `contentClassName` for
 * those instead -- it's applied to the motion.div that's the real parent of
 * `children`. (This exact mistake -- layout classes passed as `className` on a
 * two-child Reveal -- previously broke My listings' title/button header row and
 * three section headers + the feature grid on the homepage, none of which were
 * actually laying out side-by-side despite the classes being present in markup.)
 */
export default function Reveal({
  children,
  delay = 0,
  className = '',
  contentClassName = '',
}: {
  children: ReactNode
  delay?: number
  className?: string
  contentClassName?: string
}) {
  return (
    <div className={`h-full overflow-hidden ${className}`}>
      <motion.div
        initial={{ y: '100%' }}
        whileInView={{ y: '0%' }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
        className={`h-full ${contentClassName}`}
      >
        {children}
      </motion.div>
    </div>
  )
}
