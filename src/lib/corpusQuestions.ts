// Tier 1 of docs/tiered-quiz-generation-plan.md §4 — quiz questions built from
// real sentences in the Tatoeba corpus.
//
// Searches per INFLECTED FORM, not per lemma. That distinction is the whole
// idea: a lemma search matches the query string, so "łóżko" never returns
// "łóżku", and coverage collapses to 6%. Searching the form itself covers 54%
// of this vocabulary's 3,784 distinct forms, with a median of 7 sentences each.
//
// Reads a bundled snapshot rather than the live API — see corpusSnapshot.ts for
// why. Every lookup is instant and offline, which is what removed the pacing,
// concurrency caps and negative caching an earlier version needed.
//
// Accuracy comes free: a human wrote the sentence.

import { rejectReason } from './questionChecks'
import { findSentences, corpusAvailable } from './corpusSnapshot'
import { putSentences } from './sentenceStorage'
import { paradigmQuestionsForCard, slotKey } from './paradigmQuestions'
import type { VocabEntry, SentenceEntry } from '../data/types'

/**
 * Picks the best sentence for a form, or null.
 *
 * Shortest-first: a short sentence makes a better cloze question, and is less
 * likely to contain the form twice — which rejectReason refuses, because
 * blanking both leaves nothing answerable.
 */
function pickSentence(candidates: string[], form: string, existing: string[]): string | null {
  return candidates
    .filter(s => rejectReason(s, form, existing) === null)
    .sort((a, b) => a.length - b.length)[0] ?? null
}

export interface CorpusRunResult {
  /** Slots that gained a real sentence. */
  added: number
  /** Slots the corpus has nothing usable for. */
  missed: number
  /** Slots that already had a stored question and were left alone. */
  skipped: number
  /** The snapshot could not be read at all — nothing was attempted. */
  unavailable: boolean
}

/**
 * Fills as many of a card's slots as the corpus can, and stores them.
 *
 * One pass over the snapshot for the whole card, not one per form.
 */
export async function generateCorpusQuestionsForCard(
  card: VocabEntry,
  existingQuestions: SentenceEntry[],
): Promise<CorpusRunResult> {
  const slots = paradigmQuestionsForCard(card)
  // Only slots without a real sentence are worth work; a slot answered by the
  // paradigm tier alone still counts as needing one.
  const covered = new Set(existingQuestions.filter(q => q.polish).map(slotKey))
  const todo = slots.filter(s => !covered.has(slotKey(s)))
  const skipped = slots.length - todo.length

  if (todo.length === 0) return { added: 0, missed: 0, skipped, unavailable: false }

  // An unreadable snapshot and a snapshot with no matches look identical from
  // the result alone, and must not: the UI would claim no sentences exist when
  // none were searched for.
  if (!(await corpusAvailable())) {
    return { added: 0, missed: 0, skipped, unavailable: true }
  }

  const found = await findSentences(todo.map(s => s.targetForm))
  const existingText = existingQuestions.map(q => q.polish ?? '').filter(Boolean)
  const questions: SentenceEntry[] = []
  let missed = 0

  for (const slot of todo) {
    const candidates = found.get(slot.targetForm.trim().toLowerCase()) ?? []
    const sentence = pickSentence(candidates, slot.targetForm, existingText)
    if (!sentence) { missed++; continue }
    questions.push({
      ...slot,
      // Keyed by slot, so a corpus sentence replaces the computed paradigm
      // question for that form rather than sitting alongside it.
      id: slotKey(slot),
      polish: sentence,
      // No english: the English export is 24.85MB — eleven times the Polish
      // data — and requiring a translation drops coverage from 54% to 46%.
      source: 'corpus',
      approved: true,   // a human wrote it; there is nothing to curate
    })
    existingText.push(sentence)
  }

  await putSentences(questions)
  return { added: questions.length, missed, skipped, unavailable: false }
}

/**
 * Fills every card's slots in ONE pass over the snapshot.
 *
 * This is why tier 1 stopped needing a queue. The network version was ~4,000
 * requests at up to 10s each; the snapshot answers every form in a single scan,
 * because the cost is per-scan, not per-form. Progress is still reported so a
 * slow device can show something, but this is seconds, not hours.
 */
export async function generateCorpusQuestionsForAll(
  cards: VocabEntry[],
  existingQuestions: SentenceEntry[],
  onProgress?: (done: number, total: number) => void,
): Promise<CorpusRunResult> {
  const covered = new Set(existingQuestions.filter(q => q.polish).map(slotKey))
  const todo: SentenceEntry[] = []
  for (const card of cards) {
    for (const slot of paradigmQuestionsForCard(card)) {
      if (!covered.has(slotKey(slot))) todo.push(slot)
    }
  }
  if (todo.length === 0) return { added: 0, missed: 0, skipped: 0, unavailable: false }
  if (!(await corpusAvailable())) {
    return { added: 0, missed: 0, skipped: 0, unavailable: true }
  }

  const found = await findSentences(todo.map(s => s.targetForm))

  // Dedupe across the whole vocabulary, not just within a card: the same
  // sentence can contain forms of two different words, and using it twice would
  // make one of the two questions answerable from memory of the other.
  const existingText = existingQuestions.map(q => q.polish ?? '').filter(Boolean)
  const used = new Set(existingText.map(t => t.trim().toLowerCase()))
  const questions: SentenceEntry[] = []
  let missed = 0

  for (let i = 0; i < todo.length; i++) {
    const slot = todo[i]
    const candidates = (found.get(slot.targetForm.trim().toLowerCase()) ?? [])
      .filter(c => !used.has(c.trim().toLowerCase()))
    const sentence = pickSentence(candidates, slot.targetForm, [])
    if (sentence) {
      used.add(sentence.trim().toLowerCase())
      questions.push({
        ...slot, id: slotKey(slot), polish: sentence,
        source: 'corpus', approved: true,
      })
    } else {
      missed++
    }
    // Yield occasionally so the progress bar can paint on a long list.
    if (i % 200 === 0) {
      onProgress?.(i, todo.length)
      await new Promise(r => setTimeout(r, 0))
    }
  }
  onProgress?.(todo.length, todo.length)

  await putSentences(questions)
  return { added: questions.length, missed, skipped: 0, unavailable: false }
}
