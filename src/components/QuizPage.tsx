import { useState, useEffect, useMemo } from 'react'
import { getSentences } from '../lib/sentenceStorage'
import { getAllReviews } from '../lib/reviewStorage'
import { getCards } from '../lib/storage'
import { getSessionQuestions } from '../lib/quizLogic'
import { paradigmQuestions, slotKey } from '../lib/paradigmQuestions'
import { useBackClose } from '../hooks/useBackClose'
import QuizTypeSelector from './quiz/QuizTypeSelector'
import CoverageSection from './quiz/CoverageSection'
import QuizSession, { type AnswerRecord } from './quiz/QuizSession'
import SessionEndScreen from './quiz/SessionEndScreen'
import type { SentenceEntry, VocabEntry } from '../data/types'

type Screen = 'selector' | 'session' | 'end'

interface Props {
  /** Empty state only: install the welcome words, then tell App so the
      vocabulary list agrees with what the quiz just gained. */
  onWelcome?: () => void
  /** Tells the quiz tour what the user just did. */
  onTourEvent?: (e: 'quiz-mode-picked' | 'quiz-answered') => void
}

export default function QuizPage({ onWelcome, onTourEvent }: Props) {
  // Sentences now live in IndexedDB, so they arrive after first paint. Cards and
  // reviews are still synchronous, and tier-3 paradigm questions come from the
  // cards — so the quiz is playable before the sentences land.
  const [sentences, setSentences] = useState<SentenceEntry[]>([])
  const [cards, setCards] = useState<VocabEntry[]>(getCards)
  const [reviews] = useState(getAllReviews)

  useEffect(() => {
    let cancelled = false
    getSentences().then(s => { if (!cancelled) setSentences(s) })
    return () => { cancelled = true }
  }, [])

  const [screen, setScreen] = useState<Screen>('selector')
  const [quizType, setQuizType] = useState<'declension' | 'conjugation'>('declension')

  // Android back inside a quiz (session/end) → back to the type selector. Back
  // on the selector itself falls through to App's tab-level handler (→ vocab list).
  useBackClose(screen !== 'selector', () => setScreen('selector'))
  const [questions, setQuestions] = useState<SentenceEntry[]>([])
  const [answers, setAnswers] = useState<AnswerRecord[]>([])
  const [startTime, setStartTime] = useState(0)
  const [sessionKey, setSessionKey] = useState(0)

  function handleStart(type: 'declension' | 'conjugation') {
    const qs = getSessionQuestions(type, 10, sentences, reviews, cards)
    if (qs.length === 0) return
    onTourEvent?.('quiz-mode-picked')
    setQuizType(type)
    setQuestions(qs)
    setAnswers([])
    setStartTime(Date.now())
    setSessionKey(k => k + 1)
    setScreen('session')
  }

  // What the selector reports: stored sentences plus every paradigm slot they
  // do not already cover. This is why a fresh install with enriched cards can
  // quiz at all — no sentence has to exist first.
  const questionCount = useMemo(() => {
    const stored = sentences.filter(s => s.approved)
    const covered = new Set(stored.map(slotKey))
    const extra = paradigmQuestions(cards).filter(q => !covered.has(slotKey(q)))
    return stored.length + extra.length
  }, [sentences, cards])

  // Slot coverage drives the phase-4 tools: how many forms have a real sentence
  // rather than a bare prompt.
  const coverage = useMemo(() => {
    const slots = paradigmQuestions(cards)
    const withSentence = new Set(sentences.filter(s => s.polish).map(slotKey))
    return {
      total: slots.length,
      filled: slots.filter(s => withSentence.has(slotKey(s))).length,
    }
  }, [sentences, cards])

  function handleComplete(records: AnswerRecord[]) {
    setAnswers(records)
    setScreen('end')
  }

  function handleRetry() {
    handleStart(quizType)
  }

  if (screen === 'selector') {
    return (
      <QuizTypeSelector
        questionCount={questionCount}
        onWelcome={onWelcome && (() => { onWelcome(); setCards(getCards()) })}
        onStart={handleStart}
        coverage={
          <CoverageSection
            cards={cards}
            sentences={sentences}
            reviews={reviews}
            slotsTotal={coverage.total}
            slotsWithSentence={coverage.filled}
            onChanged={() => { void getSentences().then(setSentences) }}
          />
        }
      />
    )
  }

  if (screen === 'session') {
    return (
      <QuizSession
        key={sessionKey}
        questions={questions}
        type={quizType}
        cards={cards}
        sentences={sentences}
        onComplete={handleComplete}
        onTourEvent={onTourEvent}
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
