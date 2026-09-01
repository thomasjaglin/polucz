import type { ReactNode } from 'react'
import GlassButton from './GlassButton'

// What a page says when it has nothing to show.
//
// Every one of these used to end the conversation: "add some vocabulary first",
// "add words and let their details fill in first". True, but it names a thing to
// do somewhere else and offers no way to get there — and on a fresh install the
// somewhere else is a tab the user has not found yet.
//
// So the shape is fixed and the content is not: each page states the one thing
// IT needs and hands over the control that does it. Flashcards and the quiz need
// words, which are one tap away and need no key. Translation needs a DeepL key,
// which is a different errand entirely, and saying "add some vocabulary" there
// would be actively wrong.

interface Props {
  /** Material Symbols ligature. */
  icon: string
  title: string
  /** One sentence: what this page needs, and why it is worth having. */
  children: ReactNode
  action?: { label: string; onClick: () => void }
  /** Quieter line under the button — a second, lesser route. */
  footnote?: ReactNode
}

export default function EmptyState({ icon, title, children, action, footnote }: Props) {
  return (
    <div className="flex flex-col items-center gap-4 px-4 pt-10 text-center">
      <span className="material-symbols-rounded text-[44px] ink-glyph">{icon}</span>
      <h2 className="font-instrument text-[20px] font-semibold text-ink/85">{title}</h2>
      <p className="max-w-[300px] font-instrument text-[14px] leading-relaxed text-ink/70">
        {children}
      </p>
      {action && (
        <GlassButton
          variant="primary"
          onClick={action.onClick}
          className="mt-1 px-6 py-3 font-instrument text-[15px]"
        >
          {action.label}
        </GlassButton>
      )}
      {footnote && (
        <p className="max-w-[300px] font-instrument text-[13px] ink-tertiary">{footnote}</p>
      )}
    </div>
  )
}
