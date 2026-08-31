// The Tatoeba snapshot tier 1 searches — see docs/tiered-quiz-generation-plan.md §4.
//
// Bundled rather than fetched per form. The live search API answers identical
// queries in anywhere from 0.3s to over 10s, which makes per-form lookup
// unusable beyond a single card, and Tatoeba publishes these exports precisely
// so tools do not hammer the API. 124,433 sentences, ~4.5MB, ~1.8MB in the APK.
//
// Measured coverage against a 761-card vocabulary: 2,031 of 3,784 distinct
// forms, 54%, median 7 sentences each. The rest fall to tier 2 or tier 3.
//
// Data is CC BY 2.0 FR. Tatoeba must be credited wherever these sentences are
// shown — see CORPUS_ATTRIBUTION.

/** Required by CC BY 2.0 FR. Render this anywhere a corpus sentence appears. */
export const CORPUS_ATTRIBUTION = 'Sentences from Tatoeba (CC BY 2.0 FR)'

let corpusPromise: Promise<string[]> | null = null

/** Loads and caches the snapshot. ~4.5MB of text, parsed once per session. */
function loadCorpus(): Promise<string[]> {
  if (corpusPromise) return corpusPromise
  corpusPromise = (async () => {
    try {
      const res = await fetch('pol-corpus.txt')
      if (!res.ok) throw new Error(`corpus ${res.status}`)
      const text = await res.text()
      return text.split('\n').filter(Boolean)
    } catch (e) {
      // Tier 1 is optional by design: without it every form still has its
      // paradigm question, so a missing snapshot degrades rather than breaks.
      console.warn('Corpus snapshot unavailable; tier 1 disabled', e)
      corpusPromise = null
      return []
    }
  })()
  return corpusPromise
}

/** Splits Polish text into lowercase word tokens, diacritics preserved. */
function tokenise(text: string): string[] {
  return text.toLowerCase().match(/[^\W\d_]+/gu) ?? []
}

/**
 * Finds sentences containing each of `forms`, in one pass over the snapshot.
 *
 * Deliberately not a persistent inverted index: indexing all 124,433 sentences
 * would hold well over a million entries in memory to answer eight questions.
 * A single scan is ~100ms and scales to a whole-vocabulary pass just as well,
 * because the cost is per-scan, not per-form.
 */
export async function findSentences(
  forms: Iterable<string>,
  perForm = 12,
): Promise<Map<string, string[]>> {
  const wanted = new Set<string>()
  for (const f of forms) wanted.add(f.trim().toLowerCase())

  const out = new Map<string, string[]>()
  if (wanted.size === 0) return out

  const corpus = await loadCorpus()
  for (const sentence of corpus) {
    for (const token of new Set(tokenise(sentence))) {
      if (!wanted.has(token)) continue
      const bucket = out.get(token)
      if (bucket) {
        if (bucket.length < perForm) bucket.push(sentence)
      } else {
        out.set(token, [sentence])
      }
    }
  }
  return out
}

/** True once the snapshot is loaded and non-empty. */
export async function corpusAvailable(): Promise<boolean> {
  return (await loadCorpus()).length > 0
}
