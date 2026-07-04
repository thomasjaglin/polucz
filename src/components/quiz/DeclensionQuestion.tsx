import { useState, useEffect, useMemo } from 'react'
import type { SentenceEntry, VocabEntry } from '../../data/types'
import { getDistractors, checkAnswer, blankSentence, grammarPrompt } from '../../lib/quizLogic'
import GlassPane from '../GlassPane'

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
      return 'border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08] hover:border-white/20 active:scale-[0.97]'
    }
    if (checkAnswer(opt, sentence.targetForm)) {
      return 'border-green-400/40 bg-green-400/15 text-green-300'
    }
    if (opt === chosen) {
      return 'border-red-400/40 bg-red-400/15 text-red-300'
    }
    return 'border-white/5 bg-white/[0.02] text-white/25'
  }

  const display = blankSentence(sentence.polish, sentence.targetForm)

  return (
    <div className="flex flex-col gap-5">
      <div className="relative rounded-[20px] shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_0_0_1px_rgba(255,255,255,0.12)]">
        <GlassPane borderRadius={20} className="absolute inset-0 z-0 rounded-[20px] bg-white/[0.02]" />
        <div className="relative z-10 p-5">
          <p className="font-instrument text-[20px] leading-relaxed text-white/90">{display}</p>
          <p className="mt-2 font-instrument text-[14px] italic text-white/40">{sentence.english}</p>
        </div>
      </div>

      <p className="font-instrument text-[13px] text-white/45">{grammarPrompt(sentence)}</p>

      <div className="grid grid-cols-2 gap-3">
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => { if (chosen === null) setChosen(opt) }}
            disabled={chosen !== null}
            className={`rounded-[16px] border px-4 py-4 font-instrument text-[17px] font-medium transition-all disabled:cursor-default ${getButtonStyle(opt)}`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}
