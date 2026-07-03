import { useState } from 'react'
import { getSentences } from '../lib/sentenceStorage'
import { getAllReviews } from '../lib/reviewStorage'
import { getCards } from '../lib/storage'
import { getSessionQuestions } from '../lib/quizLogic'
import QuizTypeSelector from './quiz/QuizTypeSelector'
import QuizSession, { type AnswerRecord } from './quiz/QuizSession'
import SessionEndScreen from './quiz/SessionEndScreen'
import type { SentenceEntry, VocabEntry } from '../data/types'

type Screen = 'selector' | 'session' | 'end'

export default function QuizPage() {
  const [sentences] = useState<SentenceEntry[]>(getSentences)
  const [cards] = useState<VocabEntry[]>(getCards)
  const [reviews] = useState(getAllReviews)

  const [screen, setScreen] = useState<Screen>('selector')
  const [quizType, setQuizType] = useState<'declension' | 'conjugation'>('declension')
  const [questions, setQuestions] = useState<SentenceEntry[]>([])
  const [answers, setAnswers] = useState<AnswerRecord[]>([])
  const [startTime, setStartTime] = useState(0)
  const [sessionKey, setSessionKey] = useState(0)

  function handleStart(type: 'declension' | 'conjugation') {
    const qs = getSessionQuestions(type, 10, sentences, reviews)
    if (qs.length === 0) return
    setQuizType(type)
    setQuestions(qs)
    setAnswers([])
    setStartTime(Date.now())
    setSessionKey(k => k + 1)
    setScreen('session')
  }

  function handleComplete(records: AnswerRecord[]) {
    setAnswers(records)
    setScreen('end')
  }

  function handleRetry() {
    handleStart(quizType)
  }

  if (screen === 'selector') {
    return <QuizTypeSelector sentenceCount={sentences.length} onStart={handleStart} />
  }

  if (screen === 'session') {
    return (
      <QuizSession
        key={sessionKey}
        questions={questions}
        type={quizType}
        cards={cards}
        onComplete={handleComplete}
      />
    )
  }

  return (
    <SessionEndScreen
      type={quizType}
      answers={answers}
      durationMs={Date.now() - startTime}
      onRetry={handleRetry}
      onBack={() => setScreen('selector')}
    />
  )
}
