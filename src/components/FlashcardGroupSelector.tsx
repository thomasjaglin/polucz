import { useState } from 'react'
import type { VocabEntry } from '../data/types'
import { getAllReviews } from '../lib/reviewStorage'
import { isConquered } from '../lib/scheduler'
import {
  buildGroups, getGroupSize, setGroupSize, GROUP_SIZES,
  type GroupSize, type GroupStat, type Grade,
} from '../lib/flashcardGroups'
import GlassButton from './GlassButton'
import EmptyState from './EmptyState'
import { installStarterDeck } from '../lib/starterDeck'
import GlassPane from './GlassPane'
import HardModeToggle from './HardModeToggle'
import FlipOnChange from './FlipOnChange'

interface Props {
  cards: VocabEntry[]
  conqueredCount: number
  hardMode: boolean
  onToggleHardMode: () => void
  onResetMastery: () => void
  onPlayAll: () => void
  onPlayGroup: (g: GroupStat) => void
  /** Empty state only: install the welcome words. Absent when there is nothing to install. */
  onWelcome?: () => void
}

// Soft per-grade gradients. The advanced grades run cool and cohesive —
// mastered → strong flows violet → indigo → blue — while `learning` is a warm
// orange → red that deliberately contrasts, so early cards stand out from
// confident ones at a glance. `new` stays the empty track.
const GRADE_GRADIENT: Record<Exclude<Grade, 'new'>, string> = {
  mastered: 'linear-gradient(90deg, #B4A0FF, #818CF8)',
  strong:   'linear-gradient(90deg, #6366F1, #38BDF8)',
  learning: 'linear-gradient(90deg, #FB923C, #EF4444)',
}

// Stacked confidence bar: filled segments (mastered | strong | learning) over an
// empty track for the not-yet-touched cards.
function GradedBar({ counts, total }: { counts: Record<Grade, number>; total: number }) {
  const pct = (n: number) => (total ? (n / total) * 100 : 0)
  return (
    <div className="relative mt-2 flex h-[8px] w-full overflow-hidden rounded-full bg-ink/[0.06] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
      {(['mastered', 'strong', 'learning'] as const).map(g => (
        counts[g] > 0 && (
          <div key={g} style={{ width: `${pct(counts[g])}%`, background: GRADE_GRADIENT[g] }} className="h-full" />
        )
      ))}
    </div>
  )
}

function breakdown(counts: Record<Grade, number>): string {
  const parts: string[] = []
  if (counts.new) parts.push(`${counts.new} new`)
  if (counts.learning) parts.push(`${counts.learning} learning`)
  if (counts.strong) parts.push(`${counts.strong} strong`)
  if (counts.mastered) parts.push(`${counts.mastered} mastered`)
  return parts.join(' · ') || 'empty'
}

function GroupRow({ group, onPlay }: { group: GroupStat; onPlay: () => void }) {
  const done = group.playable === 0
  const pct = Math.round(group.progress * 100)
  return (
    <GlassButton
      onClick={onPlay}
      disabled={done}
      radius={24}
      pane="bg-ink/[0.02]"
      contentClassName="block w-full text-left"
      className="w-full border border-ink/10 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.2)] disabled:opacity-45"
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-instrument text-[15px] font-semibold text-ink/90">
              Words {group.start}–{group.end}
            </span>
            {done ? (
              <span className="material-symbols-rounded shrink-0 text-[18px] text-accent/80">military_tech</span>
            ) : (
              <span className="shrink-0 font-instrument text-[12px] tabular-nums ink-tertiary">{pct}%</span>
            )}
          </div>
          <GradedBar counts={group.counts} total={group.cards.length} />
          <span className="mt-1.5 block font-instrument text-[11px] ink-tertiary">{breakdown(group.counts)}</span>
        </div>
        {!done && (
          <span className="material-symbols-rounded shrink-0 text-[20px] ink-glyph">chevron_right</span>
        )}
      </div>
    </GlassButton>
  )
}

export default function FlashcardGroupSelector({ cards, conqueredCount, hardMode, onToggleHardMode, onResetMastery, onPlayAll, onPlayGroup , onWelcome }: Props) {
  const [size, setSize] = useState<GroupSize>(getGroupSize)
  const reviews = getAllReviews()
  const groups = buildGroups(cards, size, reviews)
  const playableTotal = cards.filter(c => { const r = reviews[c.id]; return !r || !isConquered(r) }).length

  function changeSize(s: GroupSize) { setSize(s); setGroupSize(s) }

  return (
    <div className="animate-fade-in flex w-full flex-col gap-5">
      {/* Header: title + lifetime mastery */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-instrument text-[22px] font-semibold text-ink/90">Flashcards</h2>
          <p className="mt-1 font-instrument text-[14px] ink-tertiary">
            {playableTotal} to review
          </p>
        </div>
        <div className="mb-1 flex shrink-0 items-center gap-2">
          <HardModeToggle active={hardMode} onToggle={onToggleHardMode} />
          <div className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-ink/[0.04] px-2.5 py-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]">
            <span className="material-symbols-rounded text-[15px] text-accent/80">military_tech</span>
            <span className="font-instrument text-[12px] font-medium tabular-nums ink-tertiary">{conqueredCount}</span>
          </div>
        </div>
      </div>

      {cards.length === 0 ? (
        <EmptyState
          icon="style"
          title="Nothing to review yet"
          action={onWelcome && { label: 'Start with dzień dobry', onClick: onWelcome }}
          footnote="Or add your own words from the vocabulary tab."
        >
          Flashcards need words, and need nothing else — no key, no connection.
          Start with <em>dzień dobry</em>: two words, fully declined, due right away.
        </EmptyState>
      ) : playableTotal === 0 ? (
        // Everything is mastered — nothing left to drill; offer a mastery reset.
        <div className="flex flex-col items-center gap-4 pt-10 text-center">
          <span className="material-symbols-rounded text-[56px] text-accent/60">military_tech</span>
          <h3 className="font-instrument text-[22px] font-semibold text-ink/80">All conquered!</h3>
          <p className="font-instrument text-[15px] ink-tertiary">You've mastered every card.</p>
          <GlassButton variant="primary" onClick={onResetMastery} className="mt-1 px-6 py-3 font-instrument text-[15px]">
            <span className="material-symbols-rounded text-[18px]">replay</span>
            Play again (resets mastery)
          </GlassButton>
        </div>
      ) : (
        <>
          {/* Group-size toggle */}
          <div className="flex items-center gap-3">
            <div className="relative flex gap-1 rounded-full p-1">
              <GlassPane borderRadius={999} className="absolute inset-0 z-0 rounded-full bg-ink/[0.03]" />
              {GROUP_SIZES.map(s => (
                <button
                  key={s}
                  onClick={() => changeSize(s)}
                  className={`relative z-10 rounded-full px-3.5 py-1 font-instrument text-[13px] font-medium tabular-nums transition-colors ${
                    s === size ? 'bg-accent/20 text-ink' : 'ink-tertiary hover:text-ink/70'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Play everything — flips with hard mode, echoing the flashcard. */}
          <FlipOnChange trigger={hardMode} className="w-full">
            <GlassButton
              onClick={onPlayAll}
              radius={24}
              pane="bg-accent/[0.06]"
              contentClassName="block w-full text-left"
              className="w-full border border-accent/20 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.25)]"
            >
              <div className="flex items-center gap-4">
                <span className="material-symbols-rounded shrink-0 text-[28px] text-accent">shuffle</span>
                <div className="min-w-0">
                  <div className="font-instrument text-[17px] font-semibold text-ink/90">Go through everything</div>
                  <div className="font-instrument text-[13px] ink-tertiary">All {playableTotal} cards, shuffled</div>
                </div>
                <span className="material-symbols-rounded ml-auto shrink-0 text-[20px] ink-glyph">chevron_right</span>
              </div>
            </GlassButton>
          </FlipOnChange>

          {/* Group list — each card flips with hard mode, staggered into a cascade. */}
          <div className="flex flex-col gap-3">
            <span className="font-instrument text-[13px] uppercase tracking-wider ink-tertiary">Or pick a group</span>
            {groups.map(g => (
              <FlipOnChange key={g.index} trigger={hardMode} delay={Math.min(g.index * 0.03, 0.3)} className="w-full">
                <GroupRow group={g} onPlay={() => onPlayGroup(g)} />
              </FlipOnChange>
            ))}
          </div>
        </>
      )}

      {/* Clearance so the last group sits above the bottom nav */}
      <div aria-hidden="true" className="h-[120px] shrink-0" />
    </div>
  )
}
