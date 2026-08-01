import { type CSSProperties, type ReactNode } from 'react'
import type { MotionValue } from 'framer-motion'
import { useGlassFilter } from '../hooks/useGlassFilter'

interface Props {
  borderRadius: number
  className?: string
  style?: CSSProperties
  children?: ReactNode
  /** Live z-rotation (deg) of this pane, for tilting cards, so the webgl
   *  glass rotates to match instead of ghosting as an upright frame. */
  rotation?: MotionValue<number>
  /** Clip this pane's webgl glass to its nearest scrolling ancestor, so the
   *  glass doesn't paint past the container's overflow edge when scrolled. */
  clipToScroll?: boolean
}

// Applies the per-element computed displacement map via --glass-filter CSS variable.
// The .kube-glass-bg::before picks it up with filter: var(--glass-filter).
// Blur is handled separately by backdrop-filter: blur() on the same ::before.
export default function GlassPane({ borderRadius, className = '', style, children, rotation, clipToScroll }: Props) {
  const { elRef, filterCss } = useGlassFilter(borderRadius, rotation, clipToScroll)

  return (
    <div
      ref={elRef as React.RefObject<HTMLDivElement>}
      className={`kube-glass-bg ${className}`}
      style={{ '--glass-filter': filterCss, ...style } as CSSProperties}
    >
      {children}
    </div>
  )
}
