import type { ButtonHTMLAttributes, ReactNode } from 'react'
import GlassPane from './GlassPane'

type Variant = 'primary' | 'secondary'

// Named button recipes so the two standard treatments aren't hand-copied at
// every call site. A variant supplies the radius, pane tint and border+text
// colour; the caller still owns sizing/padding/text-size via className, and can
// override radius/pane explicitly when needed.
const VARIANTS: Record<Variant, { radius: number; pane: string; classes: string }> = {
  primary:   { radius: 24, pane: 'bg-[#B4A0FF]/15', classes: 'border border-[#B4A0FF]/25 font-medium text-[#B4A0FF]' },
  secondary: { radius: 24, pane: 'bg-[#F8FAFC]/5',  classes: 'border border-[#F8FAFC]/10 text-[#F8FAFC]/60' },
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Standard recipe: 'primary' (accent) or 'secondary' (neutral). */
  variant?: Variant
  radius?: number
  /** Tint classes for the glass pane behind the content, e.g. "bg-[#F8FAFC]/5" */
  pane?: string
  /** Layout of the content row; defaults to a centered flex row */
  contentClassName?: string
  children: ReactNode
}

// Standard glass treatment for buttons: a GlassPane (backdrop blur +
// refraction + rim light) fills the button behind a z-raised content row.
// Size, padding, borders, text and state colors stay on className; the pane
// tint goes on `pane`.
export default function GlassButton({
  variant,
  radius,
  pane,
  contentClassName = 'flex w-full items-center justify-center gap-2',
  className = '',
  style,
  children,
  ...rest
}: Props) {
  const v = variant ? VARIANTS[variant] : null
  const r = radius ?? v?.radius ?? 16
  const paneTint = pane ?? v?.pane ?? 'bg-[#F8FAFC]/5'
  return (
    <button
      {...rest}
      style={{ borderRadius: r, ...style }}
      className={`relative transition-all active:scale-[0.97] disabled:pointer-events-none ${v?.classes ?? ''} ${className}`}
    >
      <GlassPane borderRadius={r} className={`absolute inset-0 z-0 ${paneTint}`} style={{ borderRadius: r }} />
      <span className={`relative z-10 ${contentClassName}`}>{children}</span>
    </button>
  )
}
