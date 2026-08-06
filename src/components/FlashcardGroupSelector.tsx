import { useState } from 'react'
import type { VocabEntry } from '../data/types'
import { getAllReviews } from '../lib/reviewStorage'
import { isConquered } from '../lib/scheduler'
import {
  buildGroups, getGroupSize, setGroupSize, GROUP_SIZES,
  type GroupSize, type GroupStat, type Grade,
} from '../lib/flashcardGroups'
import GlassButton from './GlassButton'
import GlassPane from './GlassPane'

interface Props {
  cards: VocabEntry[]
  conqueredCount: number
  onResetMastery: () => void
  onPlayAll: () => void
  onPlayGroup: (g: GroupStat) => void
}

// Colours for the stacked grade bar — amber (learning) → green (strong) → purple
// (mastered), reading as increasing confidence. `new` is the empty track.
const GRADE_COLOR: Record<Exclude<Grade, 'new'>, string> = {
  learning: '#FCD34D',
  strong:   '#34D399',
  mastered: '#B4A0FF',
}

// Stacked confidence bar: filled segments (mastered | strong | learning) over an
// empty track for the not-yet-touched cards.
function GradedBar({ counts, total }: { counts: Record<Grade, number>; total: number }) {
  const pct = (n: number) => (total ? (n / total) * 100 : 0)
  return (
    <div className="relative mt-2 flex h-[8px] w-full overflow-hidden rounded-full bg-[#F8FAFC]/[0.06] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
      {(['mastered', 'strong', 'learning'] as const).map(g => (
        counts[g] > 0 && (
          <div key={g} style={{ width: `${pct(counts[g])}%`, background: GRADE_COLOR[g] }} className="h-full" />
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
      pane="bg-[#F8FAFC]/[0.02]"
      contentClassName="block w-full text-left"
      className="w-full border border-[#F8FAFC]/10 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.2)] disabled:opacity-45"
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-instrument text-[15px] font-semibold text-[#F8FAFC]/90">
              Words {group.start}–{group.end}
            </span>
            {done ? (
              <span className="material-symbols-rounded shrink-0 text-[18px] text-[#B4A0FF]/80">military_tech</span>
            ) : (
              <span className="shrink-0 font-instrument text-[12px] tabular-nums text-[#F8FAFC]/40">{pct}%</span>
            )}
          </div>
          <GradedBar counts={group.counts} total={group.cards.length} />
          <span className="mt-1.5 block font-instrument text-[11px] text-[#F8FAFC]/35">{breakdown(group.counts)}</span>
        </div>
        {!done && (
          <span className="material-symbols-rounded shrink-0 text-[20px] text-[#F8FAFC]/25">chevron_right</span>
        )}
      </div>
    </GlassButton>
  )
}

export default function FlashcardGroupSelector({ cards, conqueredCount, onResetMastery, onPlayAll, onPlayGroup }: Props) {
  const [size, setSize] = useState<GroupSize>(getGroupSize)
  const reviews = getAllReviews()
  const groups = buildGroups(cards, size, reviews)
  const playableTotal = cards.filter(c => { const r = reviews[c.id]; return !r || !isConquered(r) }).length

  function changeSize(s: GroupSize) { setSize(s); setGroupSize(s) }

  return (
    <div className="animate-fade-in flex w-full flex-col gap-5">
      {/* Header: title + lifetime mastery */}
      <div className="-mt-14 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-instrument text-[22px] font-semibold text-[#F8FAFC]/90">Flashcards</h2>
          <p className="mt-1 font-instrument text-[14px] text-[#F8FAFC]/40">
            {playableTotal} to review · {conqueredCount} mastered
          </p>
        </div>
        <div className="mb-1 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#F8FAFC]/10 bg-[#F8FAFC]/[0.04] px-2.5 py-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]">
          <span className="material-symbols-rounded text-[15px] text-[#B4A0FF]/80">military_tech</span>
          <span className="font-instrument text-[12px] font-medium tabular-nums text-[#F8FAFC]/55">{conqueredCount}</span>
        </div>
      </div>

      {cards.length === 0 ? (
        <p className="mt-8 text-center font-instrument text-[16px] text-[#F8FAFC]/40">
          No cards yet — add some vocabulary first.
        </p>
      ) : playableTotal === 0 ? (
        // Everything is mastered — nothing left to drill; offer a mastery reset.
        <div className="flex flex-col items-center gap-4 pt-10 text-center">
          <span className="material-symbols-rounded text-[56px] text-[#B4A0FF]/60">military_tech</span>
          <h3 className="font-instrument text-[22px] font-semibold text-[#F8FAFC]/80">All conquered!</h3>
          <p className="font-instrument text-[15px] text-[#F8FAFC]/40">You've mastered every card.</p>
          <GlassButton variant="primary" onClick={onResetMastery} className="mt-1 px-6 py-3 font-instrument text-[15px]">
            <span className="material-symbols-rounded text-[18px]">replay</span>
            Play again (resets mastery)
          </GlassButton>
        </div>
      ) : (
        <>
          {/* Group-size toggle */}
          <div className="flex items-center gap-3">
            <span className="font-instrument text-[13px] text-[#F8FAFC]/40">Group size</span>
            <div className="relative flex gap-1 rounded-full p-1">
              <GlassPane borderRadius={999} className="absolute inset-0 z-0 rounded-full bg-[#F8FAFC]/[0.03]" />
              {GROUP_SIZES.map(s => (
                <button
                  key={s}
                  onClick={() => changeSize(s)}
                  className={`relative z-10 rounded-full px-3.5 py-1 font-instrument text-[13px] font-medium tabular-nums transition-colors ${
                    s === size ? 'bg-[#B4A0FF]/20 text-[#F8FAFC]' : 'text-[#F8FAFC]/45 hover:text-[#F8FAFC]/70'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Play everything */}
          <GlassButton
            onClick={onPlayAll}
            radius={24}
            pane="bg-[#B4A0FF]/[0.06]"
            contentClassName="block w-full text-left"
            className="w-full border border-[#B4A0FF]/20 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.25)]"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#B4A0FF]/15">
                <span className="material-symbols-rounded text-[24px] text-[#B4A0FF]">shuffle</span>
              </div>
              <div className="min-w-0">
                <div className="font-instrument text-[17px] font-semibold text-[#F8FAFC]/90">Go through everything</div>
                <div className="font-instrument text-[13px] text-[#F8FAFC]/45">All {playableTotal} cards, shuffled</div>
              </div>
              <span className="material-symbols-rounded ml-auto shrink-0 text-[20px] text-[#F8FAFC]/25">chevron_right</span>
            </div>
          </GlassButton>

          {/* Group list */}
          <div className="flex flex-col gap-3">
            <span className="font-instrument text-[13px] uppercase tracking-wider text-[#F8FAFC]/35">Or pick a group</span>
            {groups.map(g => (
              <GroupRow key={g.index} group={g} onPlay={() => onPlayGroup(g)} />
            ))}
          </div>
        </>
      )}

      {/* Clearance so the last group sits above the bottom nav */}
      <div aria-hidden="true" className="h-[120px] shrink-0" />
    </div>
  )
}
