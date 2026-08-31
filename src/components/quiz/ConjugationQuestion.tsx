import { useState, useEffect, useRef } from 'react'
import type { SentenceEntry } from '../../data/types'
import { checkAnswer, blankSentence, grammarPrompt } from '../../lib/quizLogic'
import { getGlassMode } from '../../lib/glassMode'
import GlassPane from '../GlassPane'
import GlassButton from '../GlassButton'
import { motion } from 'framer-motion'

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
  // A paradigm question (tier 3) has no sentence — grammarPrompt below carries
  // the whole question on its own, so the context card is simply omitted.
  const display = sentence.polish ? blankSentence(sentence.polish, sentence.targetForm) : null

  const borderClass =
    phase === 'correct' ? 'border-ok/50 ring-1 ring-ok/25' :
    phase === 'wrong-can-retry' || phase === 'wrong-final' ? 'border-err/50 ring-1 ring-err/25' :
    'border-ink/20'

  // Same scoped frost as the translate input so webgl mode blurs the backdrop
  // behind the field (the canvas glass sits behind the gradient there).
  const frostStyle = getGlassMode() === 'webgl'
    ? { backdropFilter: 'blur(8px) saturate(1.2)', WebkitBackdropFilter: 'blur(8px) saturate(1.2)' }
    : undefined

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

      <div className="flex flex-col gap-1.5">
        <div
          className={`relative rounded-[16px] border shadow-[0_8px_32px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.18)] transition-all ${borderClass}`}
          style={frostStyle}
        >
          <GlassPane borderRadius={16} className="absolute inset-0 z-0 rounded-[16px] pane-field-soft" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
            disabled={locked}
            placeholder="Type the missing form…"
            className="relative z-10 w-full bg-transparent px-4 py-3.5 font-instrument text-[17px] text-ink/90 placeholder-tertiary outline-none disabled:opacity-60"
          />
        </div>
        <p className="font-instrument text-[11px] ink-tertiary">
          Enable Polish keyboard for ą ę ó ś ź ż ć ń ł
        </p>
      </div>

      {phase === 'wrong-can-retry' && (
        <motion.div
          className="flex items-center gap-3"
          animate={{ x: [0, -4, 4, -2.5, 0] }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        >
          <p className="font-instrument text-[14px] text-err/80">Not quite — try again</p>
          <GlassButton
            onClick={handleTryAgain}
            radius={12}
            pane="bg-ink/5"
            className="border border-ink/10 px-3 py-1.5 font-instrument text-[13px] text-ink/65"
          >
            Try again
          </GlassButton>
        </motion.div>
      )}

      {phase === 'wrong-final' && (
        <motion.div
          className="rounded-[16px] border border-err/25 bg-err/[0.08] px-4 py-3"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.33, 1, 0.68, 1] }}
        >
          <p className="font-instrument text-[12px] text-err/70">Correct answer</p>
          <p className="font-instrument text-[18px] font-medium text-err">{sentence.targetForm}</p>
        </motion.div>
      )}

      {phase === 'correct' && (
        <motion.div
          className="rounded-[16px] border border-ok/25 bg-ok/[0.08] px-4 py-3"
          initial={{ opacity: 0, y: 6, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.26, ease: [0.33, 1, 0.68, 1] }}
        >
          <p className="font-instrument text-[15px] text-ok">Correct!</p>
        </motion.div>
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
