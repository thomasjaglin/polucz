import { useState, useCallback } from 'react'
import type { SentenceEntry, VocabEntry } from '../../data/types'
import { checkAnswer } from '../../lib/quizLogic'
import { haptics } from '../../lib/haptics'
import DeclensionQuestion from './DeclensionQuestion'
import ConjugationQuestion from './ConjugationQuestion'

export interface AnswerRecord {
  polish: string
  correct: string
  given: string
  wasCorrect: boolean
}

interface Props {
  questions: SentenceEntry[]
  type: 'declension' | 'conjugation'
  cards: VocabEntry[]
  sentences: SentenceEntry[]
  onComplete: (answers: AnswerRecord[]) => void
}

export default function QuizSession({ questions, type, cards, sentences, onComplete }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<AnswerRecord[]>([])

  const current = questions[currentIdx]

  const handleAnswered = useCallback((given: string) => {
    const record: AnswerRecord = {
      polish: current.polish,
      correct: current.targetForm,
      given,
      wasCorrect: checkAnswer(given, current.targetForm),
    }
    if (record.wasCorrect) haptics.correct(); else haptics.wrong()
    const next = [...answers, record]
    if (currentIdx + 1 >= questions.length) {
      onComplete(next)
    } else {
      setAnswers(next)
      setCurrentIdx(i => i + 1)
    }
  }, [current, answers, currentIdx, questions.length, onComplete])

  if (!current) return null

  const progress = ((currentIdx + 1) / questions.length) * 100

  return (
    <div className="flex flex-col gap-5">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F8FAFC]/10">
          <div
            className="h-full rounded-full bg-[#B4A0FF] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="shrink-0 font-instrument text-[13px] text-[#F8FAFC]/35">
          {currentIdx + 1} / {questions.length}
        </span>
      </div>

      {type === 'declension' ? (
        <DeclensionQuestion
          key={current.id}
          sentence={current}
          cards={cards}
          sentences={sentences}
          onAnswered={handleAnswered}
        />
      ) : (
        <ConjugationQuestion
          key={current.id}
          sentence={current}
          onAnswered={handleAnswered}
        />
      )}
    </div>
  )
}
