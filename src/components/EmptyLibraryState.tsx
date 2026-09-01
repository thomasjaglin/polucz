import EmptyState from './EmptyState'
import { getLlmConfig } from '../lib/llmConfig'
import type { PageId } from '../data/types'

// What every page says when there is nothing to work with.
//
// The tour now owns the job the "Start with dzień dobry" button used to do, so
// a user who skipped everything really does have an empty app. That is the
// deliberate trade — a real first save teaches more than a pre-filled shelf —
// and it makes these screens load-bearing: each one has to name the actual next
// step rather than complain about the absence.
//
// The next step depends only on whether a key exists, so it is decided here
// once instead of in four places.

interface Props {
  /** Material Symbols ligature for this page. */
  icon: string
  title: string
  /** One sentence about what THIS page needs the words for. */
  children: React.ReactNode
  onChangePage: (id: PageId) => void
}

export default function EmptyLibraryState({ icon, title, children, onChangePage }: Props) {
  const hasKey = !!getLlmConfig()

  return (
    <EmptyState
      icon={icon}
      title={title}
      action={hasKey
        ? { label: 'Go to Translate', onClick: () => onChangePage('translate') }
        : { label: 'Set up a key', onClick: () => onChangePage('api_config') }}
      footnote={
        <>
          {hasKey
            ? 'Translate a sentence and tap the words you want to keep.'
            : 'Polucz writes your cards for you — translation, every form, real examples. That needs a key of your own.'}
          {' '}
          <button
            onClick={() => onChangePage('help')}
            className="underline underline-offset-4"
          >
            Or take the tour
          </button>
          .
        </>
      }
    >
      {children}
    </EmptyState>
  )
}
