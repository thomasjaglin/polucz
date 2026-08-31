// Layer 1 validation from docs/tiered-quiz-generation-plan.md §7 — the checks
// that run on device, free, for every tier.
//
// These replace LanguageTool, which cannot run on a phone (§8). They are weaker
// at grammar and stronger at the failure that actually breaks a question: the
// target form not being in the sentence, or being in it twice. Say that plainly
// in any user-facing copy — this is not grammatical validation.

/** Matches a form only as a whole word. */
export function formPattern(form: string): RegExp {
  const escaped = form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Unicode letter boundaries, not \b: \b is ASCII-only and mis-handles ł, ó, ż,
  // so "dom" would otherwise match inside "domu".
  return new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, 'giu')
}

export function countOccurrences(sentence: string, form: string): number {
  return sentence.match(formPattern(form))?.length ?? 0
}

// A cloze sentence needs enough context to be a question, and little enough to
// read on a phone. Corpus text is more variable than generated text, so the band
// is wider than the 8–12 the desktop prompts ask for.
//
// Three, not four: "Miałem ból głowy." is three words and was one of the better
// real hits found when measuring corpus coverage. A floor of four would have
// thrown it away. Two-word hits ("Potrząsnął głową.") are still rejected — one
// remaining word is no more context than the paradigm question already gives.
const MIN_WORDS = 3
const MAX_WORDS = 18
const MAX_CHARS = 160

export type RejectReason =
  | 'form-absent' | 'form-repeated' | 'too-short' | 'too-long'
  | 'not-a-sentence' | 'duplicate'

/**
 * Whether a sentence can carry a question for `form`. Returns null when it
 * passes, or the reason it does not — callers log the reason rather than
 * silently dropping candidates, so a tier that never yields anything is
 * diagnosable.
 */
export function rejectReason(
  sentence: string,
  form: string,
  existing: string[] = [],
): RejectReason | null {
  const text = sentence.trim()

  const hits = countOccurrences(text, form)
  if (hits === 0) return 'form-absent'
  // Blanking every occurrence would leave a question with no answerable slot.
  if (hits > 1) return 'form-repeated'

  const words = text.split(/\s+/).filter(Boolean).length
  if (words < MIN_WORDS) return 'too-short'
  if (words > MAX_WORDS || text.length > MAX_CHARS) return 'too-long'

  // A title, list item or bare fragment reads badly as a cloze prompt.
  if (!/[.!?…]["'»)]?$/.test(text)) return 'not-a-sentence'

  const norm = text.toLowerCase()
  if (existing.some(e => e.trim().toLowerCase() === norm)) return 'duplicate'

  return null
}

export function isUsable(sentence: string, form: string, existing: string[] = []): boolean {
  return rejectReason(sentence, form, existing) === null
}
