// Tier 2 of docs/tiered-quiz-generation-plan.md §5 — quiz sentences written by
// the user's own LLM, for the forms the corpus could not supply.
//
// Only ~46% of forms miss the corpus, so this is the smaller half of the work
// and the only tier that costs the user anything. It is skipped entirely when
// no key is configured: generation must never be what makes the quiz
// unavailable, because tier 3 always answers.
//
// One call per card, not per form. That is a ~6x saving, and it introduces the
// one failure this module exists to catch: with several forms in a response the
// model can pair a sentence with the wrong slot. Every item echoes the form it
// used, and anything that does not match the paradigm is discarded.

import { generateJson } from './llmClient'
import { getLlmConfig } from './llmConfig'
import { rejectReason } from './questionChecks'
import { putSentences } from './sentenceStorage'
import { paradigmQuestionsForCard, slotKey } from './paradigmQuestions'
import { QUIZ_SENTENCES_SCHEMA, QUIZ_SENTENCES_PROMPTS } from '../../shared/llmTasks.js'
import type { VocabEntry, SentenceEntry } from '../data/types'

/** Describes one slot to the model in the terms the prompt expects. */
function describeSlot(q: SentenceEntry): string {
  if (q.cardType === 'noun') return `"${q.targetForm}" — ${q.targetCase} ${q.targetNumber}`
  if (q.cardType === 'verb') return `"${q.targetForm}" — present tense, ${q.targetPronoun}`
  return `"${q.targetForm}" — nominative singular ${q.targetGender}`
}

interface ModelSentence { form?: string; polish?: string; english?: string }

/**
 * Asks for one sentence per slot and keeps only what verifies.
 *
 * Two gates, both local: the echoed form must be one we asked for, and the
 * sentence must pass the same deterministic checks every tier uses.
 */
async function askFor(
  card: VocabEntry,
  slots: SentenceEntry[],
  existingText: string[],
): Promise<Map<string, { polish: string; english: string }>> {
  const cfg = getLlmConfig()
  const out = new Map<string, { polish: string; english: string }>()
  if (!cfg || slots.length === 0) return out

  const type = card.type as keyof typeof QUIZ_SENTENCES_PROMPTS
  const system = QUIZ_SENTENCES_PROMPTS[type]
  if (!system) return out

  const input = `Lemma: "${card.id}" (English: "${card.en}").\nForms:\n` +
    slots.map(describeSlot).join('\n')

  const parsed = await generateJson(cfg, { system, input, schema: QUIZ_SENTENCES_SCHEMA })
  const items = Array.isArray(parsed?.sentences) ? (parsed.sentences as ModelSentence[]) : []

  // Case-insensitive so an echo differing only in capitalisation still matches;
  // the stored form is always the paradigm's, never the model's.
  const wanted = new Map(slots.map(s => [s.targetForm.trim().toLowerCase(), s]))
  const seen = [...existingText]

  for (const item of items) {
    const echoed = item?.form?.trim().toLowerCase()
    const polish = item?.polish?.trim()
    const english = item?.english?.trim()
    if (!echoed || !polish || !english) continue

    const slot = wanted.get(echoed)
    // The model answered for a form we did not ask about, or mangled the echo.
    // Either way the sentence cannot be trusted to belong to any slot.
    if (!slot) continue
    if (rejectReason(polish, slot.targetForm, seen) !== null) continue

    out.set(slotKey(slot), { polish, english })
    seen.push(polish)
  }
  return out
}

export interface GeneratedRunResult {
  added: number
  /** Slots the model could not produce a usable sentence for, after the retry. */
  missed: number
  /** True when no LLM key is configured — nothing was attempted. */
  notConfigured: boolean
}

/**
 * Fills a card's remaining slots with generated sentences.
 *
 * `existingQuestions` should already include anything tier 1 stored, so this
 * only pays for what the corpus genuinely missed.
 */
export async function generateLlmQuestionsForCard(
  card: VocabEntry,
  existingQuestions: SentenceEntry[],
): Promise<GeneratedRunResult> {
  if (!getLlmConfig()) return { added: 0, missed: 0, notConfigured: true }

  const covered = new Set(existingQuestions.filter(q => q.polish).map(slotKey))
  const todo = paradigmQuestionsForCard(card).filter(s => !covered.has(slotKey(s)))
  if (todo.length === 0) return { added: 0, missed: 0, notConfigured: false }

  const existingText = existingQuestions.map(q => q.polish ?? '').filter(Boolean)
  let results = await askFor(card, todo, existingText)

  // One retry, for the slots the batch dropped or misaligned. Asking for them
  // alone removes the pairing ambiguity that made them fail.
  const stillMissing = todo.filter(s => !results.has(slotKey(s)))
  if (stillMissing.length > 0 && stillMissing.length < todo.length) {
    for (const slot of stillMissing) {
      const retry = await askFor(card, [slot], [...existingText, ...[...results.values()].map(v => v.polish)])
      const hit = retry.get(slotKey(slot))
      if (hit) results = new Map([...results, [slotKey(slot), hit]])
    }
  }

  const questions: SentenceEntry[] = todo
    .filter(s => results.has(slotKey(s)))
    .map(s => ({
      ...s,
      id: slotKey(s),
      polish: results.get(slotKey(s))!.polish,
      english: results.get(slotKey(s))!.english,
      source: 'generated' as const,
      // Auto-approved: the user paid for it from their own vocabulary, and a
      // bad sentence costs one skipped question, not a shipped defect. The
      // desktop curation tool (§8) is where grammar gets a second opinion.
      approved: true,
    }))

  await putSentences(questions)
  return { added: questions.length, missed: todo.length - questions.length, notConfigured: false }
}
