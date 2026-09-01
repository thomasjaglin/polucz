import type { ReactNode } from 'react'
import GlassButton from './GlassButton'
import Logo from './Logo'

// What a page says when it has nothing to show.
//
// Deliberately spare. An empty screen is where someone has the least context
// and the least patience, so it carries one mark, one line, one thing to do,
// and — where a tour exists for it — one quieter way in. Explanatory paragraphs
// were tried and made the first screen of the app read as homework.

interface Props {
  /** Material Symbols ligature, or the app mark when this is the first screen. */
  icon?: string
  useLogo?: boolean
  title: string
  /** Optional one-liner: what THIS page needs. Omitted where the title says it. */
  children?: ReactNode
  action?: { label: string; onClick: () => void }
  /** The quieter second route, under the primary. Same wording everywhere. */
  secondary?: { label: string; onClick: () => void }
}

export default function EmptyState({ icon, useLogo, title, children, action, secondary }: Props) {
  return (
    <div className="flex flex-col items-center gap-4 px-4 pt-10 text-center">
      {useLogo
        ? <Logo size={72} className="opacity-90" />
        : <span className="material-symbols-rounded text-[44px] ink-glyph">{icon}</span>}

      <h2 className="font-instrument text-[20px] font-semibold text-ink/85">{title}</h2>

      {children && (
        <p className="max-w-[300px] font-instrument text-[14px] leading-relaxed text-ink/70">
          {children}
        </p>
      )}

      {action && (
        <GlassButton
          variant="primary"
          onClick={action.onClick}
          className="mt-1 px-6 py-3 font-instrument text-[15px]"
        >
          {action.label}
        </GlassButton>
      )}

      {secondary && (
        <button
          onClick={secondary.onClick}
          className="font-instrument text-[14px] ink-tertiary underline underline-offset-4"
        >
          {secondary.label}
        </button>
      )}
    </div>
  )
}
