# Landing page assets

Captured from the shipping app with `scripts/capture-landing-assets.mjs`.
Every asset uses the **bundled 26-word starter deck**, never the real vocabulary —
nothing personal appears in a marketing image.

## Transparent element cut-outs

PNG with a real alpha channel, drop shadow included, nothing behind it. Drop these
straight onto any background.

| File | What it is | Size (pt) |
|---|---|---|
| `card-{light,dark}.png` | One vocabulary card — *trudny / difficult* | 378 × 99 |
| `filter-pane-{light,dark}.png` | Type filters, search and word count | 378 × 97 |
| `bottom-nav-{light,dark}.png` | The floating navigation pill | 262 × 62 |
| `quiz-modes-{light,dark}.png` | A quiz-mode row | 378 × 87 |
| `word-detail-{light,dark}.png` | The full word card with its declension table | 382 × 1287 |

**One caveat.** The app's glass has no colour of its own — it samples whatever is
behind it. On a transparent canvas there is nothing to sample, so the capture gives
the panes an explicit frosted fill (80% white / 82% near-black) to stand in for it.
They will therefore look very slightly more opaque than the app does over its
gradient. Place them on a soft, light background and the difference disappears; place
them on a busy photo and they will read as solid rather than as glass.

## Full screens

Captured with the gradient intact, at 430 × 932 pt @3x — the right input for a phone
mockup.

`screen-list`, `screen-detail`, `screen-flashcards`, `screen-quiz`, `screen-audio`
— each in `-light` and `-dark`.

## `upload/` — for Figma Make and friends

Same images, long edge capped at 1400px (cut-outs) or 1000px (screens), so all twelve
come to ~2.9 MB and can be attached to a prompt. Figma Make cannot open a link — not to
the artifact, not to anything — so assets have to be uploaded and the brief pasted. See
`docs/landing/figma-make-brief.md`.

## Regenerating

```sh
npm run build && npx vite preview --port 4173      # serve the built app
# start Chrome with --headless=new --remote-debugging-port=9222
node scripts/capture-landing-assets.mjs
```
