import type { AnchorName } from './anchors'

// What each tour says, in order.
//
// A step either advances on a real action the user takes (`advanceOn`) or on a
// Next button (`nextLabel`). Never both: if the step is teaching a gesture, the
// gesture is the only way forward, which is what makes the tour a rehearsal
// rather than a slideshow.

export type TourEvent =
  | 'translate-done' | 'words-added' | 'card-opened' | 'examples-loaded' | 'modal-closed'
  | 'nav-flashcards'
  | 'fc-started' | 'fc-revealed' | 'fc-swiped-right' | 'fc-swiped-left'
  | 'quiz-mode-picked' | 'quiz-answered'
  | 'audio-started'

export interface TourStep {
  anchor: AnchorName
  text: string
  /** The real action that completes this step. */
  advanceOn?: TourEvent
  /** Or a button, for steps that only point something out. */
  nextLabel?: string
  /**
   * Advance automatically if the anchor never appears. For steps that only
   * apply to some cards — comparatives exist on an adjective and not on a noun,
   * and pointing a spotlight at nothing is the worst kind of tour bug.
   */
  skipIfMissing?: boolean
}

export const ARRIVAL_STEPS: TourStep[] = [
  {
    anchor: 'translate-input',
    text: 'In the translate page you can translate from Polish or from English. Let’s start by translating “Dzień dobry”, the everyday Polish greeting.',
    nextLabel: 'Next',
  },
  {
    anchor: 'translate-button',
    text: 'Tap Translate.',
    advanceOn: 'translate-done',
  },
  {
    // One highlight over the translation and the words it found, so the
    // connection between them is the thing being pointed at.
    anchor: 'translate-result',
    text: 'Add both words to your vocabulary to start your learning journey!',
    advanceOn: 'words-added',
  },
  {
    anchor: 'vocab-cards',
    text: 'Now your cards are in your vocabulary list.',
    nextLabel: 'Next',
  },
  {
    anchor: 'vocab-filter',
    text: 'In this section you can see how many cards your deck has, filter by word type, as well as search words specifically.',
    nextLabel: 'Next',
  },
  {
    anchor: 'vocab-cards',
    text: 'Tap a card to open it and see everything Polucz knows about the word.',
    advanceOn: 'card-opened',
  },
  {
    anchor: 'card-declensions',
    text: 'Every form of the word, filled in for you. This is what you will be quizzed on later.',
    nextLabel: 'Next',
  },
  {
    anchor: 'card-comparative',
    text: 'Adjectives also compare — good, better, best.',
    nextLabel: 'Next',
    skipIfMissing: true,
  },
  {
    anchor: 'examples-button',
    text: 'Tap to load real sentences using this word.',
    advanceOn: 'examples-loaded',
  },
  {
    // The sentences are the payoff of the step before, so the tour waits here
    // rather than moving on the moment they appear.
    anchor: 'card-examples',
    text: 'Real sentences from Tatoeba, showing the word as people actually use it. Take a moment with them.',
    nextLabel: 'Next',
  },
  {
    anchor: 'modal-close',
    text: 'Close the card when you are done reading.',
    advanceOn: 'modal-closed',
  },
  {
    anchor: 'vocab-cards',
    text: 'Now open the other one — the noun and the adjective behave differently.',
    advanceOn: 'card-opened',
  },
  {
    anchor: 'card-declensions',
    text: 'Every form of the word, filled in for you. This is what you will be quizzed on later.',
    nextLabel: 'Next',
  },
  {
    anchor: 'card-comparative',
    text: 'Adjectives also compare — good, better, best.',
    nextLabel: 'Next',
    skipIfMissing: true,
  },
  {
    anchor: 'examples-button',
    text: 'Tap to load real sentences using this word.',
    advanceOn: 'examples-loaded',
  },
  {
    // The sentences are the payoff of the step before, so the tour waits here
    // rather than moving on the moment they appear.
    anchor: 'card-examples',
    text: 'Real sentences from Tatoeba, showing the word as people actually use it. Take a moment with them.',
    nextLabel: 'Next',
  },
  {
    anchor: 'modal-close',
    text: 'Close the card when you are done reading.',
    advanceOn: 'modal-closed',
  },
  {
    anchor: 'nav-flashcards',
    text: 'That is the loop: find a word, keep it, learn it. Tap Flashcards to start reviewing.',
    advanceOn: 'nav-flashcards',
  },
]
