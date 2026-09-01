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
]
