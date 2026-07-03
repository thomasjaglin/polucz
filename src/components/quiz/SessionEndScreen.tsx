import { useEffect, useRef } from 'react'
import type { AnswerRecord } from './QuizSession'
import { saveSession } from '../../lib/quizHistory'

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
      <h2 className="font-instrument text-[22px] font-semibold text-white/90">Session complete</h2>

      {/* Score card */}
      <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-5 py-6 text-center">
        <div className="font-instrument text-[52px] font-bold leading-none text-white/90">
          {score}
          <span className="text-[30px] text-white/35">/{total}</span>
        </div>
        <div className="mt-2 font-instrument text-[14px] text-white/40">{timeStr}</div>
      </div>

      {/* Wrong answers */}
      {wrong.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="font-instrument text-[12px] uppercase tracking-wider text-white/35">Review</p>
          {wrong.map((a, i) => (
            <div key={i} className="rounded-[16px] border border-red-400/15 bg-red-400/[0.04] px-4 py-3">
              <p className="line-clamp-1 font-instrument text-[12px] text-white/35">{a.polish}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="font-instrument text-[15px] text-red-400/65 line-through">{a.given || '—'}</span>
                <span className="material-symbols-rounded text-[14px] text-white/25">arrow_forward</span>
                <span className="font-instrument text-[15px] text-green-400">{a.correct}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <button
          onClick={onRetry}
          className="w-full rounded-[16px] border border-[#B4A0FF]/20 bg-[#B4A0FF]/10 py-3.5 font-instrument text-[16px] font-medium text-[#B4A0FF] transition-all hover:bg-[#B4A0FF]/15"
        >
          Try again
        </button>
        <button
          onClick={onBack}
          className="w-full rounded-[16px] border border-white/10 bg-white/[0.03] py-3.5 font-instrument text-[16px] font-medium text-white/55 transition-all hover:bg-white/[0.06]"
        >
          Back to menu
        </button>
      </div>
    </div>
  )
}
