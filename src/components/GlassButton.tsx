import type { ButtonHTMLAttributes, ReactNode } from 'react'
import GlassPane from './GlassPane'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
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
  radius = 16,
  pane = 'bg-[#F8FAFC]/5',
  contentClassName = 'flex w-full items-center justify-center gap-2',
  className = '',
  style,
  children,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      style={{ borderRadius: radius, ...style }}
      className={`relative transition-all active:scale-[0.97] disabled:pointer-events-none ${className}`}
    >
      <GlassPane borderRadius={radius} className={`absolute inset-0 z-0 ${pane}`} style={{ borderRadius: radius }} />
      <span className={`relative z-10 ${contentClassName}`}>{children}</span>
    </button>
  )
}
