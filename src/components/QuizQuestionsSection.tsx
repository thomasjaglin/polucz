import { useState, useEffect, useCallback } from 'react'
import type { VocabEntry, SentenceEntry } from '../data/types'
import { getSentences } from '../lib/sentenceStorage'
import { paradigmQuestionsForCard, slotKey } from '../lib/paradigmQuestions'
import { generateCorpusQuestionsForCard } from '../lib/corpusQuestions'
import { CORPUS_ATTRIBUTION } from '../lib/corpusSnapshot'
import { generateLlmQuestionsForCard } from '../lib/generatedQuestions'
import { getLlmConfig } from '../lib/llmConfig'
import { haptics } from '../lib/haptics'
import GlassButton from './GlassButton'

// Tier 1 on demand, for one card (docs/tiered-quiz-generation-plan.md §10).
//
// The card is already quizzable before anything here runs — tier 3 builds
// questions from its own tables. What this adds is context: a real sentence
// from the corpus in place of a bare "genitive singular of X".

export default function QuizQuestionsSection({ entry }: { entry: VocabEntry }) {
  const [stored, setStored] = useState<SentenceEntry[] | null>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const load = useCallback(async () => {
    const all = await getSentences()
    setStored(all.filter(s => s.cardLemma === entry.id))
  }, [entry.id])

  useEffect(() => { void load() }, [load])

  const slots = paradigmQuestionsForCard(entry)
  // Only records with an actual sentence count as "with context" — a slot with
  // none still asks a perfectly good paradigm question.
  const withSentence = stored
    ? new Set(stored.filter(s => s.polish).map(slotKey)).size
    : 0

  // Nothing to offer: unenriched cards and `unknown` have no paradigm at all.
  if (slots.length === 0) return null

  async function run() {
    if (running || !stored) return
    haptics.tap()
    setRunning(true); setResult(null)
    try {
      const r = await generateCorpusQuestionsForCard(entry, stored)
      await load()
      setResult(
        r.unavailable
          ? 'The sentence corpus could not be loaded'
          : r.added > 0
            ? `Added ${r.added} sentence${r.added === 1 ? '' : 's'} from real usage`
            : r.skipped === slots.length
              ? 'Every form already has a sentence'
              : 'No real sentences found for these forms',
      )
    } catch {
      setResult('Could not reach the sentence corpus')
    } finally {
      setRunning(false)
    }
  }

  // Tier 2, for what the corpus could not supply. Only offered when a key
  // exists — generation must never be what makes the quiz unavailable.
  async function generate() {
    if (running || !stored) return
    haptics.tap()
    setRunning(true); setResult(null)
    try {
      const r = await generateLlmQuestionsForCard(entry, stored)
      await load()
      setResult(
        r.notConfigured
          ? 'No API key set — add one in App settings'
          : r.added > 0
            ? `Wrote ${r.added} sentence${r.added === 1 ? '' : 's'} with your LLM`
            : 'The model returned nothing usable for these forms',
      )
    } catch {
      setResult('Could not reach your LLM provider')
    } finally {
      setRunning(false)
    }
  }

  const remaining = slots.length - withSentence
  const hasKey = !!getLlmConfig()

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-ink/10 pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-instrument text-[14px] ink-tertiary">Quiz questions</span>
        <span className="font-instrument text-[13px] tabular-nums ink-tertiary">
          {withSentence} of {slots.length} with a sentence
        </span>
      </div>

      <p className="font-instrument text-[13px] leading-relaxed ink-tertiary">
        All {slots.length} forms are already quizzable. Adding real sentences from
        the Tatoeba corpus gives each one context instead of a bare prompt.
      </p>

      {remaining > 0 && (
        <div className="flex flex-col gap-2">
          <GlassButton
            variant="secondary"
            onClick={run}
            disabled={running}
            className="px-5 py-2.5 font-instrument text-[14px]"
          >
            {running ? 'Working…' : `Find sentences for ${remaining} form${remaining === 1 ? '' : 's'}`}
          </GlassButton>
          {/* Second, because the corpus is free and human-written; the LLM is
              for what it misses and costs the user's own quota. */}
          {hasKey && (
            <GlassButton
              variant="secondary"
              onClick={generate}
              disabled={running}
              className="px-5 py-2.5 font-instrument text-[14px]"
            >
              {running ? 'Working…' : 'Write the rest with your LLM'}
            </GlassButton>
          )}
        </div>
      )}

      {result && (
        <p className="font-instrument text-[13px] ink-tertiary">{result}</p>
      )}

      {/* CC BY 2.0 FR requires crediting Tatoeba wherever its sentences appear —
          and only there. Crediting it for sentences an LLM wrote would be wrong
          in the other direction. */}
      {stored?.some(q => q.source === 'corpus') && (
        <p className="font-instrument text-[11px] ink-tertiary">{CORPUS_ATTRIBUTION}</p>
      )}
    </div>
  )
}
