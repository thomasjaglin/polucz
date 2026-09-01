import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import GlassPane from './GlassPane'

type Variant = 'primary' | 'secondary' | 'danger'

// Named button recipes so the standard treatments aren't hand-copied at every
// call site. A variant supplies the radius, pane tint and border+text colour;
// the caller still owns sizing/padding/text-size via className, and can override
// radius/pane explicitly when needed.
const VARIANTS: Record<Variant, { radius: number; pane: string; classes: string }> = {
  primary:   { radius: 24, pane: 'bg-accent/15', classes: 'border border-accent/25 font-medium text-accent' },
  secondary: { radius: 24, pane: 'bg-ink/5',  classes: 'border border-ink/10 text-ink/60' },
  danger:    { radius: 24, pane: 'bg-red-400/10',   classes: 'border border-red-400/25 font-medium text-red-400' },
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Standard recipe: 'primary' (accent) or 'secondary' (neutral). */
  variant?: Variant
  radius?: number
  /** Tint classes for the glass pane behind the content, e.g. "bg-ink/5" */
  pane?: string
  /** Layout of the content row; defaults to a centered flex row */
  contentClassName?: string
  children: ReactNode
}

// Standard glass treatment for buttons: a GlassPane (backdrop blur +
// refraction + rim light) fills the button behind a z-raised content row.
// Size, padding, borders, text and state colors stay on className; the pane
// tint goes on `pane`.
// Forwards its ref so callers can point at the real <button> — the tour
// spotlight needs a DOM node to measure, and wrapping this in a div to get one
// would change the layout at every call site.
const GlassButton = forwardRef<HTMLButtonElement, Props>(function GlassButton({
  variant,
  radius,
  pane,
  contentClassName = 'flex w-full items-center justify-center gap-2',
  className = '',
  style,
  children,
  ...rest
}, ref) {
  const v = variant ? VARIANTS[variant] : null
  const r = radius ?? v?.radius ?? 16
  const paneTint = pane ?? v?.pane ?? 'bg-ink/5'
  return (
    <button
      {...rest}
      ref={ref}
      style={{ borderRadius: r, ...style }}
      className={`relative transition-all active:scale-[0.97] disabled:pointer-events-none ${v?.classes ?? ''} ${className}`}
    >
      <GlassPane borderRadius={r} className={`absolute inset-0 z-0 ${paneTint}`} style={{ borderRadius: r }} />
      <span className={`relative z-10 ${contentClassName}`}>{children}</span>
    </button>
  )
})

export default GlassButton
