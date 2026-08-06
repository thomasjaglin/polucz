import type { VocabEntry, ReviewState } from '../data/types'
import { isConquered } from './scheduler'

// ─── Group size ────────────────────────────────────────────────────────────────

export type GroupSize = 10 | 30 | 50
export const GROUP_SIZES: GroupSize[] = [10, 30, 50]
export const DEFAULT_GROUP_SIZE: GroupSize = 30

const SIZE_KEY = 'polucz_flashcard_group_size'

export function getGroupSize(): GroupSize {
  try {
    const v = Number(localStorage.getItem(SIZE_KEY))
    if ((GROUP_SIZES as number[]).includes(v)) return v as GroupSize
  } catch { /* ignore */ }
  return DEFAULT_GROUP_SIZE
}

export function setGroupSize(size: GroupSize) {
  try { localStorage.setItem(SIZE_KEY, String(size)) } catch { /* ignore */ }
}

// ─── Per-card confidence grade ──────────────────────────────────────────────────

// Strength is based purely on whether the user has actually been getting the word
// right: `correctStreak` counts consecutive right-swipes and is reset by a
// left-swipe or "Again". A word is "strong" once it's been swiped right
// STRONG_STREAK times in a row — regardless of how long it's been in rotation, so
// a long-known-but-still-hard word stays "learning".
const STRONG_STREAK = 3

export type Grade = 'new' | 'learning' | 'strong' | 'mastered'

export function cardGrade(state: ReviewState | undefined): Grade {
  if (!state) return 'new'
  if (isConquered(state)) return 'mastered'
  if (state.reviewCount === 0) return 'new'
  if ((state.correctStreak ?? 0) >= STRONG_STREAK) return 'strong'
  return 'learning'
}

// How much each grade counts toward a group's overall progress bar (0..1).
const GRADE_WEIGHT: Record<Grade, number> = {
  new: 0,
  learning: 0.4,
  strong: 0.75,
  mastered: 1,
}

// ─── Groups ─────────────────────────────────────────────────────────────────────

export interface GroupStat {
  index: number                     // 0-based group number
  start: number                     // 1-based first list position (inclusive)
  end: number                       // 1-based last list position (inclusive)
  cards: VocabEntry[]
  counts: Record<Grade, number>
  playable: number                  // non-mastered cards a run would actually drill
  progress: number                  // 0..1 weighted confidence across the group
}

// Split the list into fixed-size sequential chunks (oldest→newest, so groups stay
// stable as cards are added — a new card just extends the last group), each with
// its grade breakdown and weighted progress.
export function buildGroups(
  cards: VocabEntry[],
  size: number,
  reviews: Record<string, ReviewState>,
): GroupStat[] {
  const groups: GroupStat[] = []
  for (let i = 0; i < cards.length; i += size) {
    const slice = cards.slice(i, i + size)
    const counts: Record<Grade, number> = { new: 0, learning: 0, strong: 0, mastered: 0 }
    let weighted = 0
    for (const c of slice) {
      const g = cardGrade(reviews[c.id])
      counts[g]++
      weighted += GRADE_WEIGHT[g]
    }
    groups.push({
      index: groups.length,
      start: i + 1,
      end: i + slice.length,
      cards: slice,
      counts,
      playable: counts.new + counts.learning + counts.strong,
      progress: slice.length ? weighted / slice.length : 0,
    })
  }
  return groups
}
