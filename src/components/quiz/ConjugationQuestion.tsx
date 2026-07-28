import { useState, useEffect, useRef } from 'react'
import type { SentenceEntry } from '../../data/types'
import { checkAnswer, blankSentence, grammarPrompt } from '../../lib/quizLogic'
import { getGlassMode } from '../../lib/glassMode'
import GlassPane from '../GlassPane'
import GlassButton from '../GlassButton'

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
    'border-[#F8FAFC]/20'

  // Same scoped frost as the translate input so webgl mode blurs the backdrop
  // behind the field (the canvas glass sits behind the gradient there).
  const frostStyle = getGlassMode() === 'webgl'
    ? { backdropFilter: 'blur(8px) saturate(1.2)', WebkitBackdropFilter: 'blur(8px) saturate(1.2)' }
    : undefined

  return (
    <div className="flex flex-col gap-5">
      <div className="relative rounded-[20px] shadow-[0_8px_32px_rgba(0,0,0,0.25),inset_0_0_0_1px_rgba(255,255,255,0.12)]">
        <GlassPane borderRadius={20} className="absolute inset-0 z-0 rounded-[20px] bg-[#F8FAFC]/[0.02]" />
        <div className="relative z-10 p-5">
          <p className="font-instrument text-[20px] leading-relaxed text-[#F8FAFC]/90">{display}</p>
          <p className="mt-2 font-instrument text-[14px] italic text-[#F8FAFC]/40">{sentence.english}</p>
        </div>
      </div>

      <p className="font-instrument text-[13px] text-[#F8FAFC]/45">{grammarPrompt(sentence)}</p>

      <div className="flex flex-col gap-1.5">
        <div
          className={`relative rounded-[16px] border shadow-[0_8px_32px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.18)] transition-all ${borderClass}`}
          style={frostStyle}
        >
          <GlassPane borderRadius={16} className="absolute inset-0 z-0 rounded-[16px] bg-[#F8FAFC]/5" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
            disabled={locked}
            placeholder="Type the missing form…"
            className="relative z-10 w-full bg-transparent px-4 py-3.5 font-instrument text-[17px] text-[#F8FAFC]/90 placeholder:text-[#F8FAFC]/25 outline-none disabled:opacity-60"
          />
        </div>
        <p className="font-instrument text-[11px] text-[#F8FAFC]/25">
          Enable Polish keyboard for ą ę ó ś ź ż ć ń ł
        </p>
      </div>

      {phase === 'wrong-can-retry' && (
        <div className="flex items-center gap-3">
          <p className="font-instrument text-[14px] text-red-400/75">Not quite — try again</p>
          <GlassButton
            onClick={handleTryAgain}
            radius={12}
            pane="bg-[#F8FAFC]/5"
            className="border border-[#F8FAFC]/10 px-3 py-1.5 font-instrument text-[13px] text-[#F8FAFC]/65"
          >
            Try again
          </GlassButton>
        </div>
      )}

      {phase === 'wrong-final' && (
        <div className="rounded-[16px] border border-red-400/20 bg-red-400/[0.06] px-4 py-3">
          <p className="font-instrument text-[12px] text-red-400/60">Correct answer</p>
          <p className="font-instrument text-[18px] font-medium text-red-300">{sentence.targetForm}</p>
        </div>
      )}

      {phase === 'correct' && (
        <div className="rounded-[16px] border border-green-400/20 bg-green-400/[0.06] px-4 py-3">
          <p className="font-instrument text-[15px] text-green-400">Correct!</p>
        </div>
      )}

      {!locked && (
        <GlassButton
          variant="primary"
          onClick={handleSubmit}
          disabled={!input.trim()}
          className="w-full py-3.5 font-instrument text-[16px] disabled:opacity-35"
        >
          Submit
        </GlassButton>
      )}
    </div>
  )
}
