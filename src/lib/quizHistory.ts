export interface QuizSession {
  date: string
  type: 'declension' | 'conjugation'
  score: number
  total: number
  wrongAnswers: { sentence: string; correct: string; given: string }[]
}

const KEY = 'polucz_quiz_history'
const MAX = 30

export function getHistory(): QuizSession[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as QuizSession[]) : []
  } catch {
    return []
  }
}

export function saveSession(session: QuizSession): void {
  const history = getHistory()
  history.unshift(session)
  localStorage.setItem(KEY, JSON.stringify(history.slice(0, MAX)))
}
