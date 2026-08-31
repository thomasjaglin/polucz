import { useState, useEffect, useMemo } from 'react'
import type { SentenceEntry, VocabEntry } from '../../data/types'
import { getDistractors, checkAnswer, blankSentence, grammarPrompt } from '../../lib/quizLogic'
import GlassPane from '../GlassPane'
import GlassButton from '../GlassButton'

interface Props {
  sentence: SentenceEntry
  cards: VocabEntry[]
  sentences: SentenceEntry[]
  onAnswered: (given: string) => void
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function DeclensionQuestion({ sentence, cards, sentences, onAnswered }: Props) {
  const options = useMemo(() => {
    const targetCase =
      sentence.cardType === 'noun' ? sentence.targetCase :
      sentence.cardType === 'adjective' ? sentence.targetCase : ''
    const distractors = getDistractors(sentence, targetCase, cards, 3, sentences)
    return shuffle([sentence.targetForm, ...distractors])
  }, [sentence, cards, sentences])

  const [chosen, setChosen] = useState<string | null>(null)
  const isCorrect = chosen !== null ? checkAnswer(chosen, sentence.targetForm) : null

  useEffect(() => {
    if (chosen === null) return
    const delay = isCorrect ? 1200 : 2000
    const t = setTimeout(() => onAnswered(chosen), delay)
    return () => clearTimeout(t)
  }, [chosen, isCorrect, onAnswered])

  function getButtonStyle(opt: string): string {
    if (chosen === null) {
      return 'border-ink/10 text-ink/80 hover:border-ink/20'
    }
    if (checkAnswer(opt, sentence.targetForm)) {
      return 'border-green-400/40 text-green-300'
    }
    if (opt === chosen) {
      return 'border-red-400/40 text-red-300'
    }
    return 'border-ink/5 ink-tertiary'
  }

  function getPaneTint(opt: string): string {
    if (chosen === null) return 'bg-ink/5'
    if (checkAnswer(opt, sentence.targetForm)) return 'bg-green-400/15'
    if (opt === chosen) return 'bg-red-400/15'
    return 'bg-ink/[0.02]'
  }

  // A paradigm question (tier 3) has no sentence — grammarPrompt below carries
  // the whole question on its own, so the context card is simply omitted.
  const display = sentence.polish ? blankSentence(sentence.polish, sentence.targetForm) : null

  return (
    <div className="flex flex-col gap-5">
      {display && (
        <div className="relative rounded-[20px] shadow-[0_8px_32px_rgba(0,0,0,0.25),inset_0_0_0_1px_rgba(255,255,255,0.12)]">
          <GlassPane borderRadius={20} className="absolute inset-0 z-0 rounded-[20px] bg-ink/[0.02]" />
          <div className="relative z-10 p-5">
            <p className="font-instrument text-[20px] leading-relaxed text-ink/90">{display}</p>
            {sentence.english && (
              <p className="mt-2 font-instrument text-[14px] italic ink-tertiary">{sentence.english}</p>
            )}
          </div>
        </div>
      )}

      <p className="font-instrument text-[13px] ink-tertiary">{grammarPrompt(sentence)}</p>

      <div className="grid grid-cols-2 gap-3">
        {options.map(opt => (
          <GlassButton
            key={opt}
            onClick={() => { if (chosen === null) setChosen(opt) }}
            disabled={chosen !== null}
            radius={16}
            pane={getPaneTint(opt)}
            className={`border px-4 py-4 font-instrument text-[17px] font-medium disabled:cursor-default ${getButtonStyle(opt)}`}
          >
            {opt}
          </GlassButton>
        ))}
      </div>
    </div>
  )
}
