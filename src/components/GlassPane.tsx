import { type CSSProperties, type ReactNode } from 'react'
import { useGlassFilter } from '../hooks/useGlassFilter'

interface Props {
  borderRadius: number
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

// Applies the per-element computed displacement map via --glass-filter CSS variable.
// The .kube-glass-bg::before picks it up with filter: var(--glass-filter).
// Blur is handled separately by backdrop-filter: blur() on the same ::before.
export default function GlassPane({ borderRadius, className = '', style, children }: Props) {
  const { elRef, filterCss } = useGlassFilter(borderRadius)

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
