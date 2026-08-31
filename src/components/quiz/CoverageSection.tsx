import { useState, useRef } from 'react'
import type { VocabEntry, SentenceEntry, ReviewState } from '../../data/types'
import { generateCorpusQuestionsForAll } from '../../lib/corpusQuestions'
import { generateLlmQuestionsForCards } from '../../lib/generatedQuestions'
import { CORPUS_ATTRIBUTION } from '../../lib/corpusSnapshot'
import { getLlmConfig } from '../../lib/llmConfig'
import { haptics } from '../../lib/haptics'
import GlassButton from '../GlassButton'

// Phase 4 coverage tools (docs/tiered-quiz-generation-plan.md §12).
//
// Every question is already answerable — tier 3 sees to that. This is about
// upgrading bare prompts to sentences, so the two actions are offered in cost
// order: the corpus is free and instant, the LLM spends the user's own quota.

/** One tap should never be able to spend an unbounded amount of the user's quota. */
const LLM_BATCH = 15

interface Props {
  cards: VocabEntry[]
  sentences: SentenceEntry[]
  reviews: Record<string, ReviewState>
  slotsTotal: number
  slotsWithSentence: number
  onChanged: () => void
}

export default function CoverageSection({
  cards, sentences, reviews, slotsTotal, slotsWithSentence, onChanged,
}: Props) {
  const [busy, setBusy] = useState<'corpus' | 'llm' | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const cancelled = useRef(false)

  const missing = slotsTotal - slotsWithSentence
  const hasKey = !!getLlmConfig()
  if (slotsTotal === 0) return null

  async function runCorpus() {
    if (busy) return
    haptics.tap(); setBusy('corpus'); setResult(null); setProgress({ done: 0, total: missing })
    try {
      const r = await generateCorpusQuestionsForAll(cards, sentences, (done, total) =>
        setProgress({ done, total }))
      onChanged()
      setResult(
        r.unavailable ? 'The sentence corpus could not be loaded'
        : r.added > 0 ? `Added ${r.added} sentences from real usage`
        : 'No further sentences in the corpus for these forms',
      )
    } catch {
      setResult('Could not read the sentence corpus')
    } finally { setBusy(null); setProgress(null) }
  }

  async function runLlm() {
    if (busy) return
    haptics.tap(); cancelled.current = false
    setBusy('llm'); setResult(null); setProgress({ done: 0, total: 0 })
    try {
      const r = await generateLlmQuestionsForCards(
        cards, sentences, reviews, LLM_BATCH,
        p => setProgress({ done: p.done, total: p.total }),
        () => cancelled.current,
      )
      onChanged()
      setResult(
        r.notConfigured ? 'No API key set — add one in App settings'
        : r.failed ? `Wrote ${r.added}, then your provider stopped responding`
        : r.added > 0
          ? `Wrote ${r.added} sentences across ${r.cardsDone} cards` +
            (r.remaining > 0 ? ` · ${r.remaining} cards still to go` : '')
          : 'The model returned nothing usable',
      )
    } catch {
      setResult('Could not reach your LLM provider')
    } finally { setBusy(null); setProgress(null) }
  }

  return (
    <div className="mt-2 flex flex-col gap-3 border-t border-ink/10 pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-instrument text-[14px] ink-tertiary">Question quality</span>
        <span className="font-instrument text-[13px] tabular-nums ink-tertiary">
          {slotsWithSentence} of {slotsTotal} with a sentence
        </span>
      </div>

      {missing > 0 ? (
        <>
          <p className="font-instrument text-[13px] leading-relaxed ink-tertiary">
            The other {missing} ask for the form directly. Real sentences give them context.
          </p>

          <GlassButton
            variant="secondary"
            onClick={runCorpus}
            disabled={busy !== null}
            className="px-5 py-2.5 font-instrument text-[14px]"
          >
            {busy === 'corpus'
              ? progress ? `Searching… ${progress.done}/${progress.total}` : 'Searching…'
              : 'Search the corpus (free)'}
          </GlassButton>

          {hasKey && (
            <GlassButton
              variant="secondary"
              onClick={busy === 'llm' ? () => { cancelled.current = true } : runLlm}
              disabled={busy === 'corpus'}
              className="px-5 py-2.5 font-instrument text-[14px]"
            >
              {busy === 'llm'
                ? progress && progress.total > 0
                  ? `Writing… ${progress.done}/${progress.total} — tap to stop`
                  : 'Writing…'
                : `Write up to ${LLM_BATCH} cards with your LLM`}
            </GlassButton>
          )}
          {hasKey && busy === null && (
            <p className="font-instrument text-[12px] ink-tertiary">
              Uses your own API key, hardest cards first. Roughly one call per card.
            </p>
          )}
        </>
      ) : (
        <p className="font-instrument text-[13px] ink-tertiary">
          Every form has a sentence.
        </p>
      )}

      {result && <p className="font-instrument text-[13px] ink-tertiary">{result}</p>}
      {sentences.some(q => q.source === 'corpus') && (
        <p className="font-instrument text-[11px] ink-tertiary">{CORPUS_ATTRIBUTION}</p>
      )}
    </div>
  )
}
