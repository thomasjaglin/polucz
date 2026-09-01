import { useEffect, useRef } from 'react'
import type { AnswerRecord } from './QuizSession'
import { saveSession } from '../../lib/quizHistory'
import GlassButton from '../GlassButton'
import { haptics } from '../../lib/haptics'

interface Props {
  type: 'declension' | 'conjugation'
  answers: AnswerRecord[]
  durationMs: number
  onRetry: () => void
  onBack: () => void
}

export default function SessionEndScreen({ type, answers, durationMs, onRetry, onBack }: Props) {
  const saved = useRef(false)

  const score = answers.filter(a => a.wasCorrect).length
  const total = answers.length
  const wrong = answers.filter(a => !a.wasCorrect)
  const minutes = Math.floor(durationMs / 60000)
  const seconds = Math.floor((durationMs % 60000) / 1000)
  const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`

  useEffect(() => {
    if (saved.current) return
    saved.current = true
    haptics.sessionDone()
    saveSession({
      date: new Date().toISOString(),
      type,
      score,
      total,
      wrongAnswers: wrong.map(a => ({ sentence: a.polish, correct: a.correct, given: a.given })),
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-instrument text-[22px] font-semibold text-ink/90">Session complete</h2>

      {/* Score card */}
      <div className="rounded-[20px] border border-ink/10 bg-ink/[0.02] px-5 py-6 text-center">
        <div className="font-instrument text-[52px] font-bold leading-none text-ink/90">
          {score}
          <span className="text-[30px] ink-tertiary">/{total}</span>
        </div>
        <div className="mt-2 font-instrument text-[14px] ink-tertiary">{timeStr}</div>
      </div>

      {/* Wrong answers */}
      {wrong.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="font-instrument text-[12px] uppercase tracking-wider ink-tertiary">Review</p>
          {wrong.map((a, i) => (
            <div key={i} className="rounded-[16px] border border-err/15 bg-err/[0.04] px-4 py-3">
              <p className="line-clamp-1 font-instrument text-[12px] ink-tertiary">{a.polish}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="font-instrument text-[15px] text-err/65 line-through">{a.given || '—'}</span>
                <span className="material-symbols-rounded text-[14px] ink-glyph">arrow_forward</span>
                <span className="font-instrument text-[15px] text-ok">{a.correct}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <GlassButton
          variant="primary"
          onClick={onRetry}
          className="w-full py-3.5 font-instrument text-[16px]"
        >
          Try again
        </GlassButton>
        <GlassButton
          variant="secondary"
          onClick={onBack}
          className="w-full py-3.5 font-instrument text-[16px]"
        >
          Back to menu
        </GlassButton>
      </div>
    </div>
  )
}
