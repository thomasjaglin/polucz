import { useState, useCallback } from 'react'
import type { SentenceEntry, VocabEntry } from '../../data/types'
import { checkAnswer, grammarPrompt } from '../../lib/quizLogic'
import { haptics } from '../../lib/haptics'
import { deleteSentence } from '../../lib/sentenceStorage'
import { pushToast } from '../../lib/toastStore'
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
      // Paradigm questions have no sentence; the end screen still needs
      // something to show, so fall back to the grammatical prompt.
      polish: current.polish ?? grammarPrompt(current),
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

  // Reject a bad question mid-quiz. Only sentence-backed questions can be
  // rejected: a paradigm question is the card's own table, so there is nothing
  // to be wrong with it and nothing to fall back to.
  const canReject = !!current?.polish

  async function reject() {
    if (!current) return
    haptics.tap()
    await deleteSentence(current.id)
    // The slot is not lost — it reverts to its paradigm question, and any tier
    // can fill it again later.
    pushToast('Question removed', 'info')
    handleAnswered('')
  }

  if (!current) return null

  return (
    // Lift into the empty header clearance so the progress bar sits near the top.
    <div className="flex flex-col gap-5">
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

      {canReject && (
        <button
          onClick={reject}
          className="self-center font-instrument text-[12px] ink-tertiary underline underline-offset-2 transition-colors hover:text-ink/60"
        >
          Report a bad sentence
        </button>
      )}
    </div>
  )
}
