# Landing page assets

Captured from the shipping app with `npm run build && npx vite preview --host
127.0.0.1 --port 4173`, headless Chrome on `--remote-debugging-port=9222`, then
`node scripts/capture-landing-assets.mjs`.

The fixture is `demo-deck.json` in this folder — **never** the real vocabulary,
so nothing personal can reach a marketing image. It is not the shipped starter
deck either: the app welcomes a new user with just *dzień* and *dobry*, and a
two-card list makes a poor screenshot. Ten words instead, one of every card shape
the app can draw — four nouns, three verbs, two adjectives and one with no
paradigm at all — lifted from the 26-word deck the app used to install, so every
form is still the dictionary-checked one.

`piękny` is seeded as mastered so the holographic foil appears. The list renders
newest-first, i.e. the reverse of the fixture's order, so a word has to sit near
the END of `demo-deck.json` to appear near the top of a screenshot.

Both hosts must be pinned to `127.0.0.1`: Vite and Chrome otherwise disagree
about whether `localhost` means IPv4 or IPv6, and the capture silently records
Chrome's error page instead of the app.

## Transparent element cut-outs

PNG with a real alpha channel, drop shadow included, nothing behind it. Drop these
straight onto any background.

| File | What it is | Size (pt) |
|---|---|---|
| `card-{light,dark}.png` | One vocabulary card — *bardzo / very* | 378 × 99 |
| `filter-pane-{light,dark}.png` | Type filters, search and word count | 378 × 97 |
| `bottom-nav-{light,dark}.png` | The floating navigation pill | 262 × 62 |
| `quiz-modes-{light,dark}.png` | Both quiz modes | 378 × 190 |
| `word-detail-{light,dark}.png` | The full word card with its declension table — *trudny* | 382 × 1043 |

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
