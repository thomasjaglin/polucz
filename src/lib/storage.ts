import type { VocabEntry } from '../data/types'

const KEY = 'polucz_vocab'

export function getCards(): VocabEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    return JSON.parse(raw) as VocabEntry[]
  } catch {
    return []
  }
}

export function saveCard(entry: VocabEntry): void {
  const cards = getCards()
  const idx = cards.findIndex(c => c.id === entry.id)
  if (idx >= 0) cards[idx] = entry
  else cards.push(entry)
  localStorage.setItem(KEY, JSON.stringify(cards))
}

export function updateCard(id: string, patch: Partial<VocabEntry>): void {
  const cards = getCards()
  const idx = cards.findIndex(c => c.id === id)
  if (idx < 0) return
  cards[idx] = { ...cards[idx], ...patch } as VocabEntry
  localStorage.setItem(KEY, JSON.stringify(cards))
}

export function findByLemma(lemma: string): VocabEntry | undefined {
  return getCards().find(c => c.id === lemma)
}

export function deleteCard(id: string): void {
  const cards = getCards().filter(c => c.id !== id)
  localStorage.setItem(KEY, JSON.stringify(cards))
}
