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
  | 'fc-started' | 'fc-revealed' | 'fc-swiped'
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

// ─── Page tours ───────────────────────────────────────────────────────────────
//
// Nothing here is scripted. Flashcards, the quiz and pronunciation all work with
// no key and no connection, so these tours narrate the real feature doing the
// real thing — which also means they cannot go stale against a screen that
// changes underneath them.

export const FLASHCARD_STEPS: TourStep[] = [
  {
    anchor: 'fc-play-all',
    text: 'Start with the lot, shuffled. Groups are for later, when you have hundreds of words.',
    advanceOn: 'fc-started',
  },
  {
    // The card is face down and is not draggable until it is revealed, so the
    // swipe steps physically cannot come before this one.
    anchor: 'fc-card',
    text: 'Polish first. Say it out loud, then tap the card to check yourself.',
    advanceOn: 'fc-revealed',
  },
  {
    anchor: 'fc-card',
    text: 'Knew it? Swipe right — Polucz waits longer before asking again. Struggled? Swipe left and it comes back sooner. There is no wrong answer, only honest ones.',
    advanceOn: 'fc-swiped',
  },
  {
    anchor: 'fc-hard-mode',
    text: 'Hard mode turns the page red and counts every win double. Use it when a word will not stick.',
    nextLabel: 'Done',
  },
]

export const QUIZ_STEPS: TourStep[] = [
  {
    anchor: 'quiz-count',
    text: 'These questions are built from the forms of your own words — no key, no connection needed. The quiz is still in beta, so expect the odd rough edge.',
    nextLabel: 'Next',
  },
  {
    anchor: 'quiz-modes',
    text: 'Multiple choice for nouns and adjectives; type the answer for verbs. Pick one.',
    advanceOn: 'quiz-mode-picked',
  },
  {
    anchor: 'quiz-question',
    text: 'Answer it. Right or wrong is not the point — seeing what happens next is.',
    advanceOn: 'quiz-answered',
  },
]

export const AUDIO_STEPS: TourStep[] = [
  {
    anchor: 'audio-play',
    text: 'Hands-free listening: Polish, then English, then the next word. This one makes noise — turn your volume up.',
    advanceOn: 'audio-started',
  },
  {
    anchor: 'audio-speed',
    text: 'Slow it down until you can hear the endings. That is where Polish hides its grammar.',
    nextLabel: 'Next',
  },
  {
    anchor: 'audio-repeat',
    text: 'Loop a single word while you copy it out loud. This is your phone speaking, not a recording — it costs nothing and works offline.',
    nextLabel: 'Done',
  },
]

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
