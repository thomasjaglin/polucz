# Holographic Effect for Mastered Cards — Spec

## Goal

Add a visually distinctive holographic/glittery shimmer effect to vocabulary cards
that have been marked as "mastered" (conquered — interval set to 180 days). This
gives the user a clear, rewarding visual signal that a card has been conquered, and
makes the mastered filter feel like a genuine achievement gallery rather than just
a filtered list.

## Reference

poke-holo.simey.me — CSS holographic Trading Card effect by simeydotme
GitHub: github.com/simeydotme/pokemon-cards-css
Technique: CSS Transforms, Gradients, Blend-modes, Filters (pure CSS, no WebGL)

---

## What "mastered" means in the data model

A card is mastered when its ReviewState has `interval >= 150` (effectively the
180-day "Conquered" interval set by the Conquered button). Check this in
`getAllReviews()` — if `reviews[card.id]?.interval >= 150`, the card is mastered.

This check happens in VocabListPage when rendering VocabCard — pass a
`mastered: boolean` prop to VocabCard.

---

## Visual effect description

Three layered CSS effects compose the holographic appearance, all on a single
`::before` pseudo-element plus one CSS animation:

### Layer 1 — Rainbow holographic gradient (primary effect)
A diagonal linear-gradient cycling through the full hue spectrum, animated
continuously with `hue-rotate`:

```css
background: linear-gradient(
  115deg,
  transparent 20%,
  rgba(255, 210, 80,  0.35) 30%,
  rgba(255, 105, 180, 0.35) 45%,
  rgba(100, 200, 255, 0.35) 60%,
  rgba(120, 255, 160, 0.35) 75%,
  transparent 85%
);
mix-blend-mode: color-dodge;
animation: holoShift 4s linear infinite;
```

```css
@keyframes holoShift {
  0%   { filter: hue-rotate(0deg)   brightness(1.1) saturate(1.4); background-position: 0% 50%; }
  50%  { filter: hue-rotate(180deg) brightness(1.2) saturate(1.6); background-position: 100% 50%; }
  100% { filter: hue-rotate(360deg) brightness(1.1) saturate(1.4); background-position: 0% 50%; }
}
```

`background-size: 200% 200%` on the gradient lets the position shift create the
illusion of light moving across the card surface.

### Layer 2 — Glitter/sparkle texture (secondary effect)
A conic-gradient overlay that creates the sparkle point-light appearance:

```css
background-image:
  url("data:image/svg+xml,..."),   /* or a repeating-conic-gradient */
  linear-gradient(115deg, ...);    /* Layer 1 on top */
```

Simplest approach: use a `repeating-conic-gradient` for the sparkle pattern:
```css
background-image: repeating-conic-gradient(
  rgba(255,255,255,0.05) 0deg,
  transparent 1deg,
  transparent 10deg,
  rgba(255,255,255,0.05) 11deg
);
```
This creates subtle angular light-ray spokes. Layer this UNDER Layer 1 using
`background-image` with multiple values (first = topmost).

### Layer 3 — Edge specular highlight
A subtle radial gradient at the card edges to simulate rim lighting:

```css
box-shadow:
  inset 0 0 30px rgba(255, 200, 100, 0.15),
  inset 0 0 0 1px rgba(255, 220, 150, 0.3);
```

This replaces the standard card border on mastered cards with a gold-tinted glow
rather than a sharp white ring.

---

## Implementation

### Where to apply

The holographic effect goes on a `::before` pseudo-element INSIDE the card content
wrapper — specifically on the same div that currently holds the card's inner content
(the `relative z-10 flex flex-col p-[32px]` div or equivalent), NOT on the outer
GlassPane container.

Critical z-index layering (from back to front):
1. WebGL canvas (z-index: 0) — background glass rendering
2. GlassPane outer wrapper — glass frame
3. Card content wrapper (z-index: 10)
4. `::before` holographic layer (z-index: 11, pointer-events: none) ← new
5. Card text content (z-index: 12) — must stay above holographic layer

### CSS to add to index.css

```css
/* ─── Mastered card holographic effect ────────────────────────── */

.card-mastered {
  position: relative;
}

.card-mastered::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: 11;

  background-image:
    repeating-conic-gradient(
      rgba(255,255,255,0.04) 0deg,
      transparent 1deg,
      transparent 9deg,
      rgba(255,255,255,0.04) 10deg
    ),
    linear-gradient(
      115deg,
      transparent 20%,
      rgba(255, 210, 80,  0.30) 30%,
      rgba(255, 105, 180, 0.30) 45%,
      rgba(100, 200, 255, 0.30) 60%,
      rgba(120, 255, 160, 0.30) 75%,
      transparent 85%
    );

  background-size: 200% 200%, 200% 200%;
  mix-blend-mode: color-dodge;
  opacity: 0;
  transition: opacity 0.6s ease;
  animation: holoShift 4s linear infinite;
}

.card-mastered:hover::before,
.card-mastered.holo-visible::before {
  opacity: 1;
}

@keyframes holoShift {
  0% {
    filter: hue-rotate(0deg) brightness(1.1) saturate(1.4);
    background-position: 0% 50%, 0% 50%;
  }
  50% {
    filter: hue-rotate(180deg) brightness(1.2) saturate(1.6);
    background-position: 100% 50%, 100% 50%;
  }
  100% {
    filter: hue-rotate(360deg) brightness(1.1) saturate(1.4);
    background-position: 0% 50%, 0% 50%;
  }
}
```

### Visibility behaviour

The holographic effect should not be always-on at full intensity — that would be
visually exhausting in a long card list. Two states:

- **In the vocab list**: effect is subtle at rest (opacity: 0.4 always-on, not 0)
  with a gentle slow shimmer. On hover/tap: opacity: 1, shimmer speeds up
  (animation-duration: 2s instead of 4s).
- **In the mastered filter view** (when "Mastered" filter is active and all cards
  are mastered): effect at full intensity always — it's a celebration view.

Implement via:
- Always-on subtle: `opacity: 0.35` on `.card-mastered::before` base state
- Hover/active: `opacity: 1` + `animation-duration: 2s`
- Mastered filter active: add class `holo-full` to the list container, and in CSS:
  `.holo-full .card-mastered::before { opacity: 1; }`

### VocabCard.tsx changes

Add `mastered` boolean prop to VocabCard. When true:
1. Add `card-mastered` className to the card content wrapper (the inner div, not
   the outer GlassPane)
2. Replace the card's standard border/inset shadow with the gold edge glow:
   change `shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]` to
   `shadow-[inset_0_0_30px_rgba(255,200,100,0.15),inset_0_0_0_1px_rgba(255,220,150,0.3)]`
3. Optionally: add a small gold crown/star icon badge in the top-left corner of
   mastered cards (a ⭐ or trophy icon from Material Symbols) to make the status
   immediately readable even without the shimmer visible

### VocabListPage.tsx changes

When mapping cards to VocabCard components, pass:
```typescript
const reviews = getAllReviews()
const isMastered = (reviews[card.id]?.interval ?? 0) >= 150

<VocabCard
  key={card.id}
  entry={card}
  mastered={isMastered}
  ...
/>
```

Also detect when the "Mastered" filter is the only active filter, and add
`holo-full` class to the list container in that case.

---

## Flashcard game

When a mastered card appears in the flashcard game, apply the same holographic
effect to the flashcard face — same `card-mastered` class, same CSS. This gives
a clear visual signal that the card you're reviewing is one you've already
conquered, while still keeping it in the SRS rotation at its long interval.

---

## Performance considerations

CSS `mix-blend-mode: color-dodge` can be GPU-intensive when many elements use it
simultaneously. Mitigations already in spec:

- `opacity: 0.35` at rest (not 0) avoids a paint-trigger on scroll
- `will-change: filter` on the `::before` element promotes it to its own
  compositor layer — add this explicitly
- If the mastered filter view shows many cards simultaneously and frame rate drops
  on Android, fall back to `mix-blend-mode: screen` (slightly less vivid but
  lighter on the GPU) by checking device performance with a simple fps monitor
  on first render of the mastered filter

---

## What NOT to do

- Do not apply the holographic effect to the modal — it would be too overwhelming
  on a full-screen card detail view. The gold edge shadow from the card border is
  enough to carry the "mastered" signal into the modal.
- Do not use gyroscope/DeviceOrientation API for v1 — animated shimmer is the
  right v1 scope. Gyroscope-driven tilt response can be added later as a
  deliberate enhancement.
- Do not apply the effect to filter tags, nav elements, or any element other than
  the vocabulary card and flashcard game card.

---

## Build order

1. Add `card-mastered` CSS class and `@keyframes holoShift` to index.css
2. Add `mastered` prop to VocabCard, apply class conditionally to inner content wrapper
3. Test on desktop Chrome with a few mastered cards — confirm blend mode looks
   correct and doesn't interfere with WebGL glass layer
4. Pass `mastered` prop correctly from VocabListPage using review state
5. Test the "Mastered" filter view at full intensity
6. Apply the same class to the flashcard game card component
7. Test on Android device specifically — check for GPU performance issues
   with multiple mastered cards visible simultaneously

---

## Out of scope for this pass

- Gyroscope/tilt-responsive holographic effect (future enhancement)
- Custom glitter texture image (the conic-gradient approximation is sufficient for v1)
- Holographic effect in the Word Detail modal
- Per-word holographic colour customisation (same rainbow gradient for all mastered cards)
