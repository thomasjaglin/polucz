# Figma Make brief — paste this whole file

Self-contained on purpose. Figma Make cannot open a link to the artifact (or to
anything else): claude.ai serves artifacts as a JavaScript shell behind Cloudflare, so
an automated fetcher gets nothing regardless of the sharing setting. It works from what
you paste and what you upload — so everything it needs is written out below.

**How to use it**
1. Paste §1 as the prompt.
2. Attach the images from `assets/landing/upload/` (12 files, ~2.9 MB total).
3. Build page by page — §2, then §3, then §4. One page per session gives better results
   than asking for a whole site at once.

---

## §1 — The prompt (paste this first)

> Build a landing page for **Polucz**, a Polish vocabulary trainer for Android.
>
> ### Visual system
> Background `#F7F4F1`, a warm off-white — never pure white. Behind everything, five
> large blurred ellipses in `#FFC4B8`, `#FFE2BC`, `#E4D6FF`, `#C6E6FF`, `#FFD2E6`,
> blurred about 52px at 70% opacity, multiply blend. Soft and low-contrast; it must
> never compete with the text on top of it.
>
> Every surface is frosted glass, not a solid panel: ink `#0F172A` at 2–5% opacity,
> a 20px backdrop blur, **36px corner radius**, and a shadow of
> `0 8px 28px rgba(15,23,42,0.10)` **plus** an inset `0 0 0 1px rgba(15,23,42,0.08)`
> ring. That inner ring is what makes it read as glass — do not omit it. Buttons,
> tags and inputs are fully rounded pills. Nothing in this design uses an 8px radius.
>
> ### Type
> Instrument Sans throughout, weights 400 / 500 / 600.
> Hero 60px SemiBold, letter-spacing −1%. Section headings 32px SemiBold. Body 17px
> Regular, line-height 1.5. Captions 13px.
> Text colour is `#0F172A` at 100% for headings, 70% for body, 62% for captions —
> **never lighter than 62%**, it fails contrast below that. Accent `#4C2BB8` for links
> and for the translation line under a Polish word.
>
> ### Dark mode
> Background `#121212`, ink `#F8FAFC`, accent `#B4A0FF`. Text tiers become 100 / 70 /
> 55%. Swap the ellipses to `#14014A`, `#16098B`, `#2A59C8`, `#7DD1F5`, screen blend at
> 50% opacity. Shadows become `0 8px 32px rgba(0,0,0,0.25)` with an inset
> `0 0 0 1px rgba(255,255,255,0.12)` ring.
>
> ### Layout
> Calm and generous. Max content width 1120px, 96–128px between sections, plenty of air
> around the screenshots. One accent colour only.
>
> ### Tone
> Plain, confident, no marketing bluster. No invented testimonials, no user counts, no
> stock photography — the product screenshots are the imagery.

---

## §2 — Home page

**Hero**
- Eyebrow: `Polish vocabulary, on your terms`
- Headline: **The words you actually need, drilled until they stick**
- Sub: Add a Polish word. Polucz fills in the translation, the full declension or
  conjugation, and example sentences — then schedules it for review, quizzes you on
  every form, and reads it aloud.
- Buttons: `Download for Android` (primary) · `How it works` (secondary)
- Under them, small: `Free · No account · Your data stays on your phone`
- Image: `screen-list-light.png` in a phone frame, slightly rotated, with
  `card-light.png` and `filter-pane-light.png` floating outside the frame edges.

**Proof strip** — four figures on one line:
`26` words bundled, ready on first launch · `124,433` real Polish sentences in the app ·
`3` question sources, no key needed · `0` accounts, servers, subscriptions

**Five features, alternating left/right**

1. **Your list, not someone else's deck** — Type a word; the app writes the card.
   Translation, part of speech, and the full grammar table: seven cases singular and
   plural for a noun, every person for a verb, all five gender-and-number columns for
   an adjective. *Image:* `word-detail-light.png`
2. **Spaced repetition that knows what "hard" means** — Swipe through cards and the
   schedule adapts. Hard mode turns the screen red so you know you asked for it.
   *Image:* `screen-flashcards-light.png`
3. **A quiz built from your own words** *(label it "Beta")* — Fill in the blank and
   multiple choice, drawn from the exact forms of the words you added: 158 questions
   from the 26 starter words alone. *Image:* `screen-quiz-light.png`
4. **Hear it, out loud** — Pronunciation uses your phone's own speech engine. No key,
   no network, no waiting. *Image:* `screen-audio-light.png`
5. **It is yours to keep** — Export the whole collection as one JSON file to your
   Downloads folder, any time. Import it back on a new phone.

**How it works** — three steps: install the APK, nothing to sign up for · try the 26
bundled words, everything works immediately · add your own key when you want the app to
write cards for you.

**Privacy** — short, plain: vocabulary, review history and keys are stored on the device
only; there is no Polucz server; translation goes to DeepL with your key only when you
press translate; pronunciation never leaves the phone. Then the trade-off, stated openly:
keys live in the app's local storage, which is the normal bring-your-own-key arrangement
and worth knowing before you paste one in.

**Open source** — GPL-3.0 on GitHub. A distributed fork ships its source too.

**FAQ** — iPhone version? No, none planned. · Do I need a key? Not to study; only to add
and enrich words, and to translate. · What does the key cost? Cards are small requests;
ordinary use is cents, billed by your provider, never by Polucz. · Where do the sentences
come from? Tatoeba, under CC BY 2.0 FR. · Does it work offline? Studying, entirely.

**Footer** — Download · Setup guide · GitHub · Licence ·
**Sentences from Tatoeba (CC BY 2.0 FR)** · Created & Designed by Thomas Jaglin

> The Tatoeba line is a licence obligation, not a courtesy. It has to be on the site.

---

## §3 — Download page

One screen. H1 `Get Polucz`. A download button with the version and file size beside it,
`.apk`, Android 7.0+. A short "installing an APK" note in three steps, because most
people need it: tap the file once it downloads; allow installs from your browser when
Android asks; open it, there is nothing to sign in to. Then what works with no key at
all — 26 words, flashcards, quiz, pronunciation, import/export — a SHA-256 checksum, and
a link on to the setup guide.

---

## §4 — Setup page

H1 `Setting up Polucz`. Open by saying everything below is optional: flashcards, the quiz
and pronunciation work the moment you install; keys are for having the app write new
cards for you.

1. **Try it first** — tap *Start with 26 common words*, do a round, no configuration.
2. **Choose a provider** — a three-column comparison: Google Gemini (cheapest way in,
   generous free tier, aistudio.google.com) · Anthropic Claude (best grammar tables in
   testing, console.anthropic.com) · OpenAI-compatible (Groq, OpenRouter, Together, or a
   local model).
3. **Paste the key** — App settings → API → provider, model, key → Save.
4. **Add your first word** — type it in any form; the app finds the lemma and writes the card.
5. **Translation (optional)** — DeepL is a separate key; free-tier keys end in `:fx`.
6. **Pronunciation** — uses your phone's voice; if no Polish voice is installed the app
   says so and offers the screen to add one.
7. **Back it up** — Menu → Export JSON writes a file to Downloads. Import replaces the
   collection, so keep the file.

**Troubleshooting** — "No API key set yet" when adding a word: the key is missing or was
rejected, re-paste it. · Polish words are silent: no Polish voice on the device, App
settings offers the fix. · The quiz asks for a word with no sentence: that form has no
corpus sentence yet, tap **Search the corpus**.

---

## §5 — Images to attach

From `assets/landing/upload/` — resized for upload, ~2.9 MB for all twelve.

**Cut-outs, real transparency, drop shadow included:**
`card-light` · `card-dark` · `filter-pane-light` · `bottom-nav-light` ·
`quiz-modes-light` · `word-detail-light`

**Full screens for phone mockups:**
`screen-list-light` · `screen-detail-light` · `screen-quiz-light` ·
`screen-flashcards-light` · `screen-audio-light` · `screen-list-dark`

The originals at full resolution are in `assets/landing/`. Tell Figma Make that the
cut-outs already have transparent backgrounds so it does not draw a container behind them.
