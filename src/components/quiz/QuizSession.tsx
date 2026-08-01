import { useState, useCallback } from 'react'
import type { SentenceEntry, VocabEntry } from '../../data/types'
import { checkAnswer } from '../../lib/quizLogic'
import { haptics } from '../../lib/haptics'
import DeclensionQuestion from './DeclensionQuestion'
import ConjugationQuestion from './ConjugationQuestion'
import ProgressBar from '../ProgressBar'

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

  return (
    // Lift into the empty header clearance so the progress bar sits near the top.
    <div className="-mt-14 flex flex-col gap-5">
      {/* Progress — shared glass bar with the count on the right */}
      <ProgressBar done={currentIdx + 1} total={questions.length} />

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
