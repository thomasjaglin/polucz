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
    text: 'Words come from here. We have started you off with dzień dobry — the everyday Polish greeting.',
    nextLabel: 'Next',
  },
  {
    anchor: 'translate-button',
    text: 'Tap Translate.',
    advanceOn: 'translate-done',
  },
  {
    anchor: 'lemma-rows',
    text: 'Two words, each one ready to keep: dzień, a noun, and dobry, an adjective.',
    nextLabel: 'Next',
  },
  {
    anchor: 'lemma-rows',
    text: 'Swipe a word right, or tap the plus, to add it. Add both.',
    advanceOn: 'words-added',
  },
]
