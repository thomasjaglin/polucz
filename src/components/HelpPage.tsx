import { useSyncExternalStore } from 'react'
import GlassCard from './GlassCard'
import GlassButton from './GlassButton'
import { haptics } from '../lib/haptics'
import {
  TOURS, tourStatus, resetTour, subscribeTours, type TourId,
} from '../lib/tourState'

// Where every tour lives after the first run.
//
// The welcome screen promises the tour can be replayed "at any time from the
// Help page", so this is what keeps that promise. It also makes skipping safe:
// nothing is lost by saying no, because everything is here.

interface Props {
  /** Start a tour: Help closes and the tour begins on its own page. */
  onPlay: (id: TourId) => void
}

const LABEL: Record<ReturnType<typeof tourStatus>, string> = {
  unseen: 'Not taken yet',
  done: 'Completed',
  skipped: 'Skipped',
}

export default function HelpPage({ onPlay }: Props) {
  // Re-reads on any change, so a tour finished elsewhere shows as completed
  // the moment the user comes back here.
  const statuses = useSyncExternalStore(
    subscribeTours,
    () => TOURS.map(t => tourStatus(t.id)).join(','),
  )
  const list = statuses.split(',') as ReturnType<typeof tourStatus>[]

  return (
    <div className="animate-fade-in flex w-full flex-col gap-6 pt-6">
      <div className="px-2">
        <h1 className="font-instrument text-[24px] font-semibold text-ink">Help</h1>
        <p className="mt-1 font-instrument text-[14px] leading-relaxed text-ink/70">
          Short guided walkthroughs of each part of the app. They make no calls and cost nothing —
          take any of them as often as you like.
        </p>
      </div>

      <section>
        <h2 className="mb-2 px-2 font-instrument text-[13px] font-medium uppercase tracking-wider ink-tertiary">
          Tours
        </h2>
        <GlassCard contentClassName="flex flex-col divide-y divide-ink/10 p-0">
          {TOURS.map((t, i) => (
            <div key={t.id} className="flex items-center justify-between gap-4 p-5">
              <div className="min-w-0">
                <p className="font-instrument text-[16px] text-ink/85">{t.title}</p>
                <p className="mt-0.5 font-instrument text-[13px] leading-relaxed ink-tertiary">
                  {t.blurb}
                </p>
                <p className="mt-1 font-instrument text-[12px] ink-tertiary">{LABEL[list[i]]}</p>
              </div>
              <GlassButton
                variant="secondary"
                onClick={() => {
                  haptics.tap()
                  // Reset first: a completed tour has to become offerable again
                  // before it can run, and this is the one place that happens.
                  resetTour(t.id)
                  onPlay(t.id)
                }}
                className="shrink-0 px-4 py-2 font-instrument text-[14px]"
              >
                {list[i] === 'unseen' ? 'Start' : 'Replay'}
              </GlassButton>
            </div>
          ))}
        </GlassCard>
      </section>

      <section>
        <h2 className="mb-2 px-2 font-instrument text-[13px] font-medium uppercase tracking-wider ink-tertiary">
          Setting up
        </h2>
        <GlassCard contentClassName="flex flex-col gap-3 p-5">
          <p className="font-instrument text-[14px] leading-relaxed text-ink/75">
            Flashcards, the quiz and pronunciation work with no setup at all. A key of your own is
            only needed for writing new cards and for translation.
          </p>
          <p className="font-instrument text-[13px] leading-relaxed ink-tertiary">
            The full setup guide, including where to get a key, lives on the website.
          </p>
        </GlassCard>
      </section>

      <div aria-hidden="true" className="h-[120px] shrink-0" />
    </div>
  )
}
