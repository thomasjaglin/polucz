# Quiz Feature Spec — Polish Grammar Quizzes

## Overview

Two quiz types built on the approved-sentences.json dataset:
1. **Declension quiz** (nouns + adjectives) — multiple choice, 4 options
2. **Conjugation quiz** (verbs) — fill in the blank, strict exact match

Both quiz types use the same sentence-based format: show a Polish sentence with the
target word blanked out, ask the user to supply the correct form. The sentence provides
real grammatical context rather than abstract "what is the genitive of X" drilling.

---

## Data source

`approved-sentences.json` — generated offline, validated by LanguageTool, reviewed by user.
Stored in the app's localStorage under key `polon_sentences` after import.
Each sentence object shape (from the generation pipeline):

```typescript
interface QuizSentence {
  id: string
  cardLemma: string
  cardType: 'noun' | 'verb' | 'adjective'
  targetForm: string        // the correct answer
  targetCase: string        // e.g. "genitive", "instrumental"
  targetNumber?: string     // "singular" | "plural" (nouns/adjectives)
  targetPerson?: string     // "1sg", "3pl" etc. (verbs)
  targetTense?: string      // "present" | "past" (verbs)
  targetGender?: string     // "masculine" | "feminine" etc. (adjectives)
  polish: string            // full sentence with target word present
  english: string           // English translation
  approved: boolean         // must be true to appear in quiz
}
```

The sentence stored in `polish` contains the full sentence — the app blanks out the
`targetForm` at render time by replacing it with `___` for display. Do NOT store a
pre-blanked version; always blank dynamically so the original sentence is preserved.

---

## Quiz 1: Declension Quiz (nouns + adjectives)

### Format
- Show: Polish sentence with target word replaced by `___`
- Show: English translation below the sentence
- Show: Grammatical prompt label (e.g. "Genitive singular of 'kot' (cat)")
- Show: 4 answer buttons with Polish word forms
- User taps one button → immediate feedback (correct/wrong highlight) → next question

### Answer options (4 total: 1 correct + 3 distractors)

**Distractor selection rules:**
- Distractors must be the same grammatical category as the correct answer:
  - For a noun question → distractors are other nouns' forms (not verb forms)
  - For an adjective question → distractors are other adjectives' forms
- Distractors should be the same case/number slot from other words where possible
  (e.g. if the answer is genitive singular, pull genitive singular forms of 3 other
  nouns from the sentences dataset) — this prevents "obviously wrong" options
- Never use the correct answer as a distractor
- Never use the nominative (base) form of the same word as a distractor
  (too easy — it's the form they already know)
- If not enough same-case forms exist, fall back to any form of the same grammatical
  category from the dataset
- Shuffle the 4 options randomly before display — never put the correct answer in a
  fixed position

### Feedback
- Correct tap: button turns green, brief success animation, auto-advance after 1.2s
- Wrong tap: tapped button turns red, correct answer highlights green, show correct
  answer for 2s before auto-advancing
- Do NOT allow tapping other buttons after an answer is selected

---

## Quiz 2: Conjugation Quiz (verbs)

### Format
- Show: Polish sentence with target verb form replaced by `___`
- Show: English translation below the sentence
- Show: Grammatical prompt label (e.g. "Present tense, 3rd person singular of 'mówić'
  (to speak)")
- Show: A text input field with a Polish keyboard hint
- Show: Submit button (or auto-submit on Enter)

### Answer validation
- **Strict exact match** — the user's input must match `targetForm` character for character
- Polish diacritics are required: `mówię ≠ mowie`, `książkę ≠ ksiazke`
- Trim leading/trailing whitespace before comparison (don't penalise accidental spaces)
- Case-insensitive comparison (don't penalise capitalisation differences)
- Do NOT use fuzzy matching or diacritic-stripping — learning correct Polish spelling
  is an explicit goal

### Polish keyboard support
- On mobile, the standard Polish keyboard (available on Android/iOS) handles diacritics
- Add a small note below the input: "Enable Polish keyboard for ą ę ó ś ź ż ć ń ł"
- Do not build a custom on-screen diacritic picker — native keyboard is sufficient

### Feedback
- Correct: input border turns green, success message, auto-advance after 1.5s
- Wrong: input border turns red, show the correct answer below the input,
  wait 2.5s before auto-advancing (slightly longer than MC — typed answers need
  more time to review)
- Show a "Try again" option before revealing the answer on first wrong attempt
  (one retry before showing the answer) — typed production benefits from a second
  attempt more than multiple choice does

---

## Session structure

### Quiz session setup
- User selects quiz type (Declension or Conjugation) from the quiz page
- Session draws from `approved: true` sentences in localStorage
- Session length: 10 questions per session (not the full 172 at once — keeps sessions
  short and mobile-friendly)
- Question selection: weighted by SRS review state — cards with lower `easeFactor`
  or more recent `lastReviewed` dates get higher probability of appearing
  (reuse the same `ReviewState` from `polon_reviews` localStorage key)
- Do not repeat the same sentence twice in one session
- Shuffle question order within each session

### Session end screen
- Show score: X / 10 correct
- Show time taken
- List any words answered incorrectly with the correct form
- Two buttons: "Try again" (new session, same type) and "Back to menu"
- Do NOT update SRS review state from quiz performance — quiz is supplementary
  practice, not a replacement for the main flashcard SRS review

### Progress persistence
- Save session history to localStorage (`polon_quiz_history` key):
  ```typescript
  interface QuizSession {
    date: string
    type: 'declension' | 'conjugation'
    score: number
    total: number
    wrongAnswers: { sentence: string, correct: string, given: string }[]
  }
  ```
- Keep last 30 sessions only — no need for unlimited history

---

## Importing approved-sentences.json into the app

Extend the existing import flow (Option A from the generation spec):
- Add `sentences` array support to the existing JSON import handler
- When importing a backup that contains a `sentences` array, write it to
  `polon_sentences` in localStorage
- Add a separate "Import Sentences" button in Settings/API Config page for importing
  a standalone `approved-sentences.json` file without overwriting cards/reviews
- On app load, read `polon_sentences` from localStorage and make it available
  to the quiz components

---

## Quiz page UI structure

```
QuizPage
├── QuizTypeSelector        (shown when no session active)
│   ├── DeclensionQuizCard  (noun/adjective declensions)
│   └── ConjugationQuizCard (verb conjugations)
├── QuizSession             (shown during active session)
│   ├── ProgressBar         (Q3 of 10)
│   ├── SentenceDisplay     (Polish sentence with ___ gap)
│   ├── TranslationDisplay  (English translation)
│   ├── GrammarPrompt       (e.g. "Genitive singular of 'kot'")
│   ├── AnswerArea          (MC buttons OR text input depending on type)
│   └── FeedbackOverlay     (correct/wrong state)
└── SessionEndScreen        (score + wrong answers summary)
```

---

## Build order (for Claude Code)

1. Add `polon_sentences` localStorage read/write to the app's data layer —
   import the `approved-sentences.json` file manually first to confirm it loads
2. Build the question generation logic as pure functions (no UI yet):
   - `getSessionQuestions(type, count, sentences, reviews)` → QuizSentence[]
   - `getDistractors(correct, sentences, count)` → string[] for MC
   - `checkAnswer(input, targetForm)` → boolean for fill-in
   Test these functions in isolation before touching any UI
3. Build QuizTypeSelector page (static, no logic)
4. Build DeclensionQuiz session (MC format) end to end
5. Build ConjugationQuiz session (fill-in format) end to end
6. Build SessionEndScreen
7. Wire SRS-weighted question selection
8. Add quiz history persistence
9. Visual polish pass (Figma reference when available)

---

## Out of scope for this pass

- Adjective declension quiz (adjective sentences exist in the dataset but
  adjective quiz UI is more complex — multiple gender columns. Flag for v2)
- Listening quiz (hear the word, type/pick the form) — natural extension once
  TTS is wired
- Timed mode / pressure mechanics
- Leaderboard or social features
- Hint system
