import type { SentenceEntry } from '../data/types'

const KEY = 'polucz_sentences'

export function getSentences(): SentenceEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as SentenceEntry[]) : []
  } catch {
    return []
  }
}

export function saveSentences(sentences: SentenceEntry[]): void {
  localStorage.setItem(KEY, JSON.stringify(sentences))
}

export function clearSentences(): void {
  localStorage.removeItem(KEY)
}
