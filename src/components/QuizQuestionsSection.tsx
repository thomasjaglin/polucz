import { useState, useEffect, useCallback } from 'react'
import type { VocabEntry, SentenceEntry } from '../data/types'
import { getSentences } from '../lib/sentenceStorage'
import { paradigmQuestionsForCard, slotKey } from '../lib/paradigmQuestions'
import { generateCorpusQuestionsForCard } from '../lib/corpusQuestions'
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
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
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
    setRunning(true); setResult(null); setProgress({ done: 0, total: 0 })
    try {
      const r = await generateCorpusQuestionsForCard(entry, stored, (done, total) =>
        setProgress({ done, total }))
      await load()
      setResult(
        r.unreachable
          ? r.added > 0
            ? `Added ${r.added}, then the sentence corpus stopped responding — try again later`
            : 'The sentence corpus is not responding — try again later'
          : r.added > 0
            ? `Added ${r.added} sentence${r.added === 1 ? '' : 's'} from real usage`
            : r.skipped === slots.length
              ? 'Every form already has a sentence'
              : 'No real sentences found for these forms',
      )
    } catch {
      setResult('Could not reach the sentence corpus')
    } finally {
      setRunning(false); setProgress(null)
    }
  }

  const remaining = slots.length - withSentence

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-ink/10 pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-instrument text-[14px] text-ink/45">Quiz questions</span>
        <span className="font-instrument text-[13px] tabular-nums text-ink/35">
          {withSentence} of {slots.length} with a sentence
        </span>
      </div>

      <p className="font-instrument text-[13px] leading-relaxed text-ink/40">
        All {slots.length} forms are already quizzable. Adding real sentences from
        the Tatoeba corpus gives each one context instead of a bare prompt.
      </p>

      {remaining > 0 && (
        <GlassButton
          variant="secondary"
          onClick={run}
          disabled={running}
          className="px-5 py-2.5 font-instrument text-[14px]"
        >
          {running
            ? progress && progress.total > 0
              ? `Searching… ${progress.done}/${progress.total}`
              : 'Searching…'
            : `Find sentences for ${remaining} form${remaining === 1 ? '' : 's'}`}
        </GlassButton>
      )}

      {result && (
        <p className="font-instrument text-[13px] text-ink/45">{result}</p>
      )}
    </div>
  )
}
