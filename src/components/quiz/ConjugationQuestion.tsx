import { useState, useEffect, useRef } from 'react'
import type { SentenceEntry } from '../../data/types'
import { checkAnswer, blankSentence, grammarPrompt } from '../../lib/quizLogic'

interface Props {
  sentence: SentenceEntry
  onAnswered: (given: string) => void
}

type Phase = 'idle' | 'wrong-can-retry' | 'wrong-final' | 'correct'

export default function ConjugationQuestion({ sentence, onAnswered }: Props) {
  const [input, setInput] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [wrongCount, setWrongCount] = useState(0)
  const [lastGiven, setLastGiven] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (phase === 'correct') {
      const t = setTimeout(() => onAnswered(lastGiven), 1500)
      return () => clearTimeout(t)
    }
    if (phase === 'wrong-final') {
      const t = setTimeout(() => onAnswered(lastGiven), 2500)
      return () => clearTimeout(t)
    }
  }, [phase, lastGiven, onAnswered])

  function handleSubmit() {
    const trimmed = input.trim()
    if (!trimmed) return
    setLastGiven(trimmed)

    if (checkAnswer(trimmed, sentence.targetForm)) {
      setPhase('correct')
    } else {
      const newWrong = wrongCount + 1
      setWrongCount(newWrong)
      setPhase(newWrong >= 2 ? 'wrong-final' : 'wrong-can-retry')
    }
  }

  function handleTryAgain() {
    setInput('')
    setPhase('idle')
    setTimeout(() => inputRef.current?.focus(), 30)
  }

  const locked = phase === 'correct' || phase === 'wrong-final'
  const display = blankSentence(sentence.polish, sentence.targetForm)

  const borderClass =
    phase === 'correct' ? 'border-green-400/50 ring-1 ring-green-400/25' :
    phase === 'wrong-can-retry' || phase === 'wrong-final' ? 'border-red-400/50 ring-1 ring-red-400/25' :
    'border-white/15'

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
        <p className="font-instrument text-[20px] leading-relaxed text-white/90">{display}</p>
        <p className="mt-2 font-instrument text-[14px] italic text-white/40">{sentence.english}</p>
      </div>

      <p className="font-instrument text-[13px] text-white/45">{grammarPrompt(sentence)}</p>

      <div className="flex flex-col gap-1.5">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
          disabled={locked}
          placeholder="Type the missing form…"
          className={`w-full rounded-[16px] border bg-white/[0.04] px-4 py-3.5 font-instrument text-[17px] text-white/90 placeholder:text-white/25 outline-none transition-all ${borderClass} disabled:opacity-60`}
        />
        <p className="font-instrument text-[11px] text-white/25">
          Enable Polish keyboard for ą ę ó ś ź ż ć ń ł
        </p>
      </div>

      {phase === 'wrong-can-retry' && (
        <div className="flex items-center gap-3">
          <p className="font-instrument text-[14px] text-red-400/75">Not quite — try again</p>
          <button
            onClick={handleTryAgain}
            className="rounded-[10px] border border-white/10 bg-white/[0.05] px-3 py-1.5 font-instrument text-[13px] text-white/65 transition-colors hover:bg-white/[0.09]"
          >
            Try again
          </button>
        </div>
      )}

      {phase === 'wrong-final' && (
        <div className="rounded-[14px] border border-red-400/20 bg-red-400/[0.06] px-4 py-3">
          <p className="font-instrument text-[12px] text-red-400/60">Correct answer</p>
          <p className="font-instrument text-[18px] font-medium text-red-300">{sentence.targetForm}</p>
        </div>
      )}

      {phase === 'correct' && (
        <div className="rounded-[14px] border border-green-400/20 bg-green-400/[0.06] px-4 py-3">
          <p className="font-instrument text-[15px] text-green-400">Correct!</p>
        </div>
      )}

      {!locked && (
        <button
          onClick={handleSubmit}
          disabled={!input.trim()}
          className="w-full rounded-[16px] border border-[#B4A0FF]/20 bg-[#B4A0FF]/10 py-3.5 font-instrument text-[16px] font-medium text-[#B4A0FF] transition-all hover:bg-[#B4A0FF]/15 disabled:pointer-events-none disabled:opacity-35"
        >
          Submit
        </button>
      )}
    </div>
  )
}
