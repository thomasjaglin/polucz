// Tier 1 of docs/tiered-quiz-generation-plan.md §4 — quiz questions built from
// real sentences in the Tatoeba corpus.
//
// The whole idea is searching per INFLECTED FORM, not per lemma. Measured
// against the 761-card vocabulary: searching lemmas covers 6% of forms, because
// the search matches the query string, so "łóżko" never returns "łóżku".
// Searching the form itself covers 67%.
//
// Accuracy comes free: a human wrote the sentence. What it costs is latency and
// a load on a volunteer project, which is why every lookup is cached — including
// the misses, which are a third of all forms and can never change.

import { withTimeout } from './llmClient'
import { rejectReason } from './questionChecks'
import {
  getCorpusCache, putCorpusCache, putSentences,
  type CorpusHit,
} from './sentenceStorage'
import { paradigmQuestionsForCard, slotKey } from './paradigmQuestions'
import type { VocabEntry, SentenceEntry } from '../data/types'

// Measured: identical queries answer anywhere from 0.3s to over 10s. Six
// seconds reported healthy-but-slow responses as refusals.
const SEARCH_TIMEOUT_MS = 15000
/** Politeness gap between lookups. Tatoeba is volunteer-run. */
const PACE_MS = 350
/** A cached miss is trusted for this long before it is worth asking again. */
const NEGATIVE_TTL_MS = 30 * 24 * 60 * 60 * 1000
/** Give up on a run after this many refusals in a row. */
const MAX_CONSECUTIVE_FAILURES = 3

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function searchTatoeba(form: string): Promise<CorpusHit[]> {
  const url = `https://tatoeba.org/en/api_v0/search?query=${encodeURIComponent(form)}&from=pol&to=eng&sort=relevance`
  const r = await withTimeout(fetch(url, { headers: { accept: 'application/json' } }), SEARCH_TIMEOUT_MS, 'tatoeba')
  if (!r.ok) throw new Error(`tatoeba ${r.status}`)
  const data = await r.json()
  const out: CorpusHit[] = []
  for (const result of data?.results ?? []) {
    const polish = (result?.text ?? '').trim()
    if (!polish) continue
    const english = (result?.translations ?? []).flat()
      .find((t: { lang?: string; text?: string }) => t?.lang === 'eng' && t.text)?.text?.trim()
    if (!english) continue
    out.push({ polish, english, ref: result?.id ? String(result.id) : undefined })
    if (out.length >= 12) break
  }
  return out
}

type Lookup =
  | { ok: true; hits: CorpusHit[] }
  /** The corpus could not be reached — says nothing about whether the form exists. */
  | { ok: false }

/** Cache-first lookup. Returns a known miss without touching the network. */
async function hitsFor(form: string): Promise<Lookup> {
  const cached = await getCorpusCache(form)
  if (cached) {
    const fresh = cached.hits.length > 0 || Date.now() - cached.fetchedAt < NEGATIVE_TTL_MS
    if (fresh) return { ok: true, hits: cached.hits }
  }
  try {
    const hits = await searchTatoeba(form)
    await putCorpusCache({ form, hits, fetchedAt: Date.now() })
    return { ok: true, hits }
  } catch {
    // Deliberately NOT cached. A timeout or a refusal is not evidence that the
    // form is absent, and caching it as a miss would poison the slot for a
    // month — Tatoeba does throttle sustained use, so this path is real and was
    // observed during development.
    return { ok: false }
  }
}

/**
 * Picks the best sentence for a form, or null.
 *
 * Shortest-first: a short sentence makes a better cloze question and is less
 * likely to contain the form twice, which would leave nothing answerable.
 */
function pickSentence(hits: CorpusHit[], form: string, existing: string[]): CorpusHit | null {
  const usable = hits
    .filter(h => rejectReason(h.polish, form, existing) === null)
    .sort((a, b) => a.polish.length - b.polish.length)
  return usable[0] ?? null
}

export interface CorpusRunResult {
  /** Slots that gained a real sentence this run. */
  added: number
  /** Slots the corpus genuinely has nothing for — now cached as misses. */
  missed: number
  /** Slots that already had a stored question and were left alone. */
  skipped: number
  /**
   * Lookups that never reached the corpus. Distinct from `missed`: a miss means
   * the corpus answered and had nothing, a failure means it did not answer, and
   * conflating them tells the user no sentences exist when none were sought.
   */
  failed: number
  /** True when the run gave up early after repeated refusals. */
  stoppedEarly: boolean
}

/**
 * Fills as many of a card's slots as the corpus can, and stores them.
 *
 * Serial with a pause between lookups. A card is ~8 lookups, so this is a few
 * seconds — an interactive action, not a job.
 */
export async function generateCorpusQuestionsForCard(
  card: VocabEntry,
  existingQuestions: SentenceEntry[],
  onProgress?: (done: number, total: number) => void,
): Promise<CorpusRunResult> {
  const slots = paradigmQuestionsForCard(card)
  const covered = new Set(existingQuestions.filter(q => q.polish).map(slotKey))
  const todo = slots.filter(s => !covered.has(slotKey(s)))

  const existingText = existingQuestions.map(q => q.polish ?? '').filter(Boolean)
  const found: SentenceEntry[] = []
  let missed = 0
  let failed = 0
  let consecutiveFailures = 0
  let stoppedEarly = false

  for (let i = 0; i < todo.length; i++) {
    const slot = todo[i]
    const lookup = await hitsFor(slot.targetForm)

    if (!lookup.ok) {
      failed++
      // Stop rather than keep knocking. Three refusals in a row means the corpus
      // is throttling or down, and the remaining slots would fail the same way;
      // every one of them still has its paradigm question regardless.
      if (++consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) { stoppedEarly = true; break }
      onProgress?.(i + 1, todo.length)
      await sleep(PACE_MS)
      continue
    }
    consecutiveFailures = 0

    const hit = pickSentence(lookup.hits, slot.targetForm, existingText)
    if (hit) {
      found.push({
        ...slot,
        // Keyed by slot so a corpus sentence replaces the computed paradigm
        // question for the same form rather than sitting alongside it.
        id: slotKey(slot),
        polish: hit.polish,
        english: hit.english,
        source: 'corpus',
        sourceRef: hit.ref,
        approved: true,   // a human wrote it; there is nothing to curate
      })
      existingText.push(hit.polish)
    } else {
      missed++
    }
    onProgress?.(i + 1, todo.length)
    if (i < todo.length - 1) await sleep(PACE_MS)
  }

  await putSentences(found)
  return { added: found.length, missed, failed, skipped: slots.length - todo.length, stoppedEarly }
}
