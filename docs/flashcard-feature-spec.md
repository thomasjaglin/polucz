# Flashcard Practice Mode — Feature Spec

## Goal

An Anki-style spaced-repetition flashcard screen for reviewing vocabulary. Replaces the current
placeholder stub page. Uses a hybrid swipe + button interaction model, and a spaced-repetition
scheduling algorithm to decide what to show and when.

---

## Interaction model

**Swipe gestures (left / right) — for the two common, low-stakes responses:**

| Direction | Meaning | Feel |
|---|---|---|
| Swipe right | "Somewhat easy" | Positive |
| Swipe left | "Somewhat hard" | Negative |

- Single axis only (left/right) — no up/down swipe. This avoids diagonal-swipe ambiguity entirely.
- Should feel fast and low-friction — this is the response used most often, every session.
- Card should visually follow the drag (translate + slight rotate, Tinder-card-style), with a
  clear release threshold (e.g. drag past ~30% of card width triggers the action; below that,
  card springs back to center).
- Use `framer-motion` (already a good fit per the existing migration's animation needs) or
  `@use-gesture/react` + `react-spring` for the drag physics.

**Buttons (tap) — for the two extreme, low-frequency responses:**

| Button | Meaning | Label idea |
|---|---|---|
| Button A | Mark as fully learned | "Conquered" |
| Button B | Mark as needing more work | "Needs repetition" / "Again" |

- Deliberately higher friction than the swipe (a tap, not a gesture) since these are rarer,
  higher-stakes decisions — friction here is intentional, not a UX flaw.
- Consider small confirmation/feedback animation on "Conquered" specifically (this is the
  rewarding, motivational moment — worth giving it a distinct visual payoff, e.g. a brief
  glow/sparkle, distinct from the routine swipe feedback).

---

## Scheduling logic (SM-2–inspired)

Each `VocabEntry` needs new fields to support scheduling (see Data model below). On each review,
update based on which of the four responses was given:

### Swipe right — "Somewhat easy"
- Standard SM-2 "Good" response: multiply current interval by the ease factor.
- Ease factor unchanged or nudged slightly up.

### Swipe left — "Somewhat hard"
- Standard SM-2 "Hard" response: smaller interval multiplier than "easy" (e.g. ~1.2x instead of
  ~2.5x), or a fixed short bump (e.g. +1 day) if the interval is still very short.
- Ease factor nudged slightly down.

### Button — "Conquered"
- Override: set interval to a long fixed value (e.g. 180 days) regardless of current SM-2 state.
- This is a deliberate override of the algorithm, not a normal "easy" response — it's meant to
  say "I don't need to see this again for a long time," distinct from the routine swipe-right.

### Button — "Needs repetition" (lapse)
- This is an SM-2 **lapse**, not just a routine "hard":
  - Reset interval back to the starting value (e.g. 1 day) — relearn from scratch.
  - **Also reduce the ease factor** (e.g. by a fixed penalty, SM-2 commonly uses something like
    -0.2, with a floor so it can't go below a minimum). This is the detail that matters: without
    lowering the ease factor too, the card would just race back up to a long interval again on
    the next "easy" response, defeating the purpose of flagging it as needing real repetition.

### Symmetry note
Neither "Conquered" nor "Needs repetition" removes a card from the deck or sets a separate
status flag — both just push the same underlying interval value to an extreme (very long vs.
reset to start). This keeps the data model simpler: every card just needs an interval + due date,
no separate "graduated"/"suspended" status enum.

---

## Data model additions

Add to each `VocabEntry` (or a separate parallel `ReviewState` keyed by word id — decide based on
whether scheduling data should live alongside or separate from the core word data):

```ts
interface ReviewState {
  interval: number        // days until next review
  easeFactor: number       // starting value commonly 2.5 in SM-2
  dueDate: string          // ISO date string — when this card should next appear
  lastReviewed: string | null
  reviewCount: number      // total times reviewed (optional, useful for stats later)
}
```

## Session logic

- On entering the flashcard screen, filter the vocab list to cards where `dueDate <= today`
  (standard SRS queue behavior) — don't just cycle through all words regardless of schedule.
- If no cards are due, show a clear "all caught up" state rather than an empty/broken screen.
- Card order within the due queue: random, or oldest-due-first — either is fine to start with.

## Out of scope for this pass (flag, don't build yet)

- Visual polish / Figma-matched styling — a Figma MCP link will be provided separately to guide
  the frontend once the interaction logic itself works.
- Any "new card" introduction pacing (e.g. limiting how many brand-new cards enter rotation per
  day) — worth considering later, not needed for first working version.
- Undo / "oops" correction after a swipe — nice-to-have, not required initially.

## Suggested build order

1. Data model: add `ReviewState` fields, write the four update functions (easy/hard/conquered/lapse).
2. Build the due-queue filtering logic (pure function, testable in isolation).
3. Build the static card UI (no gestures yet) — just show one due card at a time with the two buttons.
4. Wire the two buttons first (simplest interaction) and confirm scheduling updates correctly.
5. Add swipe gesture + card motion last, once the underlying logic is already proven to work via buttons.
6. Visual polish pass once Figma reference is available.
