# Audio Playback Feature — TTS Spec

## Goal

Add text-to-speech audio playback to the app in two contexts:
1. **Vocab card detail modal** — a tap-to-play button that reads the Polish word (and optionally
   the English translation) aloud
2. **Flashcard game** — automatic word playback when a card is revealed, similar to how Anki
   reads a word after the card is tapped

Both use the same underlying TTS mechanism. No separate "audio playback page" is needed — audio
is an affordance within existing screens, not its own screen.

---

## Provider: Gemini TTS API

- Same API key as lemmatization (`GEMINI_API_KEY`) — no new Vercel environment variable needed
- Model: `gemini-3.1-flash-tts-preview` (or current recommended Flash TTS model — verify against
  Google AI for Developers docs at build time, since preview model names shift)
- Language detection: automatic — pass Polish text, it speaks Polish; pass English text, it
  speaks English. No language parameter needed.
- Same free-tier billing rules apply: do NOT enable billing on the Google Cloud project.
  The same 1,500 req/day free limit covers both lemmatization and TTS calls combined — at
  personal usage scale (a handful of TTS calls per session), this is not a concern.

---

## Architecture: base64 blob response, NOT streaming

**Do not stream audio through the Vercel function.** Vercel bills by milliseconds of active
function execution, including streaming wait time. For short words/phrases, the correct pattern
is:
1. Server calls Gemini TTS, waits for the complete audio response
2. Server returns the audio as a base64-encoded string in a normal JSON response body
3. Client decodes the base64, creates a Blob URL, plays it via the Web Audio API or a plain
   `<audio>` element

Audio for a single Polish word or short phrase is tiny (a few KB at most) — well within Vercel's
4.5MB response body limit, so buffering the full response server-side before returning it is
completely fine and avoids any streaming complexity or billing risk entirely.

---

## New serverless function: `/api/tts`

### Request
```json
POST /api/tts
{
  "text": "mówić",
  "language": "pl"   // or "en" — used only to shape the prompt, not as an API param
}
```

### Server logic
1. Read `GEMINI_API_KEY` from environment (never expose to client)
2. Build a minimal prompt that steers delivery style:
   - For Polish: `"Pronounce this Polish word clearly and at a natural, unhurried pace: [word]"`
   - For English: `"Say this English word clearly: [word]"`
   - Keep prompts short — this is for single words/short phrases, not narration
3. Call Gemini TTS endpoint, request audio output (verify exact response format and audio
   encoding — Gemini returns PCM or specific audio format per their docs; confirm at build time)
4. Encode the audio bytes as base64
5. Return JSON: `{ "audio": "<base64string>", "mimeType": "audio/wav" }` (or whatever MIME type
   Gemini returns — confirm at build time and return it dynamically rather than hardcoding)

### Error handling
- If Gemini returns an error, return a clear `{ error: "..." }` JSON response with an appropriate
  HTTP status — never let the client receive a malformed response
- Client should gracefully handle TTS failure (show a visible but non-blocking error state — e.g.
  the speaker icon shows an X briefly) rather than crashing or hanging

---

## Client-side audio playback

```javascript
// Pseudocode — implementation details up to Claude Code
const res = await fetch('/api/tts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: word, language: 'pl' })
})
const { audio, mimeType } = await res.json()
const blob = new Blob([Uint8Array.from(atob(audio), c => c.charCodeAt(0))], { type: mimeType })
const url = URL.createObjectURL(blob)
const player = new Audio(url)
player.play()
player.onended = () => URL.revokeObjectURL(url) // clean up memory
```

Key requirements:
- Revoke the blob URL after playback ends to avoid memory leaks (important on mobile)
- Do not autoplay without user interaction — browsers block this. In the modal, always require
  a tap. In the flashcard game, trigger playback on the user's tap/swipe action that reveals the
  card (this counts as a user gesture and satisfies browser autoplay policy)
- Show a loading indicator on the speaker button while the TTS call is in flight — do not let
  the button appear broken/unresponsive during the ~1-2s generation time
- Prevent double-triggering: disable the button while audio is loading or playing

---

## Context 1: Vocab card detail modal

### UI
- Add a small speaker icon button (🔊) next to the Polish word in the modal header
- Tapping it plays the full PL→EN→PL→EN sequence (same as flashcard mode) with 1 second
  silence between each play
- A second tap while the sequence is playing stops it; a tap after it ends replays from the start
- Show a subtle pulsing animation on the icon while the sequence is playing

### State
Local to `WordDetailModal` component:
```typescript
type AudioState = 'idle' | 'loading' | 'playing' | 'error'
const [plAudioState, setPlAudioState] = useState<AudioState>('idle')
const [enAudioState, setEnAudioState] = useState<AudioState>('idle')
```

### Caching (optional but recommended)
If the user taps the speaker button multiple times on the same word, you don't want to re-call
the API each time. A simple `useRef` cache keyed by word string (storing the base64 blob URL)
avoids redundant API calls within the same modal session. Clear the cache when the modal closes.

---

## Context 2: Flashcard game

### Trigger
Play the Polish word automatically when the user taps/swipes to reveal the answer side of a
card. This tap already constitutes a user gesture so it satisfies browser autoplay policy — do
NOT try to autoplay on card appearance without a user interaction.

### Playback sequence (double-play)
On card reveal, play the full sequence: **PL → EN → PL → EN**, with a consistent 1 second of
silence between each play. This gives the brain two encoding passes in each direction —
recognizing Polish when heard, and constructing meaning from an English prompt — which is
stronger for active recall in both directions than a single pass or a sandwich approach.

Implementation notes:
- Pre-fetch both the Polish AND English audio clips while the user reads the question side,
  so both are ready to chain immediately on reveal with no loading gaps mid-sequence
- Chain the four plays in order using the `onended` event of each Audio instance, with a
  `setTimeout` of 1000ms between each play for the silence gap
- Do not use four separate `fetch('/api/tts')` calls in sequence — pre-fetch both clips
  (PL and EN) in parallel using `Promise.all` before the sequence starts, then play them in
  order. This avoids mid-sequence loading delays.

### SRS-driven queue
The audio playback mode (current pass: just flashcard auto-play; future pass: hands-free
review page) uses the same `ReviewState` queue as the flashcard game. Harder/lapsed cards
surface more frequently; conquered cards surface rarely. This is not a separate audio queue —
it shares the same `interval`, `dueDate`, and `easeFactor` fields per card.

### UI
- Add a small speaker icon on the card that can be tapped to replay the full PL→EN→PL→EN
  sequence if the user wants to hear it again
- Show a subtle animation on the speaker icon while the sequence is playing (e.g. pulsing)
  so the user knows audio is active
- Do not auto-play the English translation in isolation — it's always part of the full sequence

---

## Audio playback page (hands-free review mode)

This is the third original use case (hands-free audio playback while busy/commuting). It uses
the same SRS due-date queue as the flashcard game — not a separate, independent queue. Cards
surface in audio playback mode with the same frequency logic as flashcard review: harder/more
recent cards appear more often, conquered cards appear rarely.

**Architectural note**: the audio queue must read from and write to the same `ReviewState` data
as the flashcard game. Do not build a separate queue or separate review-state tracking for audio
mode — they share one source of truth. A word reviewed in audio mode counts as a review and
updates the same interval/dueDate/easeFactor fields as a flashcard review would.

This mode is scoped OUT of the current pass — requires additional design work (auto-advance
logic, background audio behavior on Android WebView, lock-screen audio controls). Flag for a
dedicated spec once modal and flashcard TTS are working and proven on the real device.

---

## Build order

1. Build `/api/tts` function in isolation — test with a direct curl call (disable LuLu first)
   for both a Polish word and an English word, confirm audio bytes come back correctly
2. Build a shared `useTTS` hook (or utility function) that handles: fetch → base64 decode →
   Blob URL → play → cleanup. This gets reused in both the modal and flashcard contexts rather
   than duplicating the playback logic in two places
3. Build the full PL→EN→PL→EN sequence player using `Promise.all` for parallel pre-fetch +
   chained `onended` + `setTimeout` for silence gaps — test this in isolation before wiring
   into any UI
4. Wire up the modal speaker button with loading/playing/error states — verify on desktop
   browser first, then on the deployed APK on Android
5. Add the flashcard card-reveal auto-play trigger using the pre-fetch pattern (fetch both clips
   while question is shown, chain sequence on reveal tap)
6. Add tap-to-replay speaker icon on flashcard cards
7. (Future) Hands-free review mode — separate spec

---

## Out of scope for this pass

- Hands-free audio playback page / auto-advancing queue
- Voice speed/pitch controls
- Downloading audio clips for offline use
- Any speech-to-text (pronunciation checking) — a natural future feature but its own project
