import EmptyState from './EmptyState'
import { getLlmConfig } from '../lib/llmConfig'
import type { PageId } from '../data/types'

// What every page says when there is nothing to work with.
//
// The tour owns the job the "Start with dzień dobry" button used to do, so a
// user who skipped it really does meet an empty app. That makes these screens
// load-bearing: each has to name the actual next step rather than describe the
// absence. The step depends only on whether a key exists, so it is decided here
// once instead of in four places — and the way back to the tour is worded
// identically everywhere, because it is the same offer.

/** One wording for the tour link, used by every empty screen. */
export const TAKE_THE_TOUR = 'Take the tour'

interface Props {
  /** Material Symbols ligature. Omitted on the vocabulary list, which uses the app mark. */
  icon?: string
  useLogo?: boolean
  title: string
  /** One sentence about what THIS page needs the words for. */
  children?: React.ReactNode
  onChangePage: (id: PageId) => void
}

export default function EmptyLibraryState({ icon, useLogo, title, children, onChangePage }: Props) {
  const hasKey = !!getLlmConfig()

  return (
    <EmptyState
      icon={icon}
      useLogo={useLogo}
      title={title}
      action={hasKey
        ? { label: 'Go to Translate', onClick: () => onChangePage('translate') }
        : { label: 'Set up keys', onClick: () => onChangePage('api_config') }}
      secondary={{ label: TAKE_THE_TOUR, onClick: () => onChangePage('help') }}
    >
      {children}
    </EmptyState>
  )
}
