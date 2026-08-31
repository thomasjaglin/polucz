# Polucz landing page — structure and copy

Three pages: **Home**, **Download**, **Setup**. Copy below is written to ship, not to
be replaced with lorem. Where a number appears it is a real number from the app.

---

## Positioning

**What it is:** a Polish vocabulary trainer for Android where the words are yours —
you add them, it fills in the grammar, then drills you with spaced repetition, a
quiz built from your own words, and pronunciation.

**What makes it different, in one line:** *it does not want your account.* No sign-up,
no server, no subscription. Your vocabulary lives on your phone. The language features
run on an API key you supply, so you are the customer of your provider, not of Polucz.

**Who it is for:** people already learning Polish — living there, married into it,
studying it — who keep a word list and are tired of decks written by someone else.

**Do not oversell.** It is Android-only, it is one person's app, and adding new words
needs a key. Saying that plainly is more persuasive than hiding it, and the audience
is technical enough to notice either way.

---

## Home

### 1. Hero
- **Eyebrow:** Polish vocabulary, on your terms
- **Headline:** **The words you actually need, drilled until they stick**
- **Sub:** Add a Polish word. Polucz fills in the translation, the full declension or
  conjugation, and example sentences — then schedules it for review, quizzes you on
  every form, and reads it aloud.
- **Primary CTA:** Download for Android · **Secondary:** How it works
- **Under the buttons, small:** Free · No account · Your data stays on your phone
- **Visual:** `screen-list-light.png` in a phone frame, slightly rotated, with
  `card-light.png` and `filter-pane-light.png` floating out of the frame at the edges.
  This is the shot that has to sell the glass look.

### 2. Proof strip
Four numbers, quiet, one line:

| 26 | 124,433 | 3 | 0 |
|---|---|---|---|
| words bundled, ready on first launch | real Polish sentences in the app | question sources, no key needed | accounts, servers, subscriptions |

### 3. Features — five blocks, alternating sides

**a. Your list, not someone else's deck**
Type a word; the app writes the card. Translation, part of speech, and the full grammar
table — seven cases singular and plural for a noun, every person for a verb, all five
gender-and-number columns for an adjective.
*Asset:* `word-detail-light.png` (the `trudny` table) — the single most convincing image.

**b. Spaced repetition that knows what "hard" means**
Swipe through cards; the schedule adapts. A hard-mode run turns the whole screen red so
you know you asked for it. Words you have truly mastered get retired on purpose, not by
accident.
*Asset:* `screen-flashcards-light.png`

**c. A quiz built from your own words**
Fill in the blank and multiple choice, drawn from the exact forms of the words you added
— 158 questions from the 26 starter words alone. Questions come from a bundled corpus of
real Tatoeba sentences first, then your own LLM, then the grammar table itself, which is
why the quiz works on a fresh install with no key and no signal.
*Asset:* `screen-quiz-light.png` + `quiz-modes-light.png`
*Label it beta.* It is honest and it sets expectations.

**d. Hear it, out loud**
Pronunciation uses your phone's own speech engine. No key, no network, no waiting for
audio to generate.
*Asset:* `screen-audio-light.png`

**e. It is yours to keep**
Export the whole collection as one JSON file into your Downloads folder, any time.
Import it back on a new phone. Nothing is locked in a service that can disappear.
*Asset:* the export toast, or a plain file icon — do not over-illustrate this one.

### 4. How it works — three steps
1. **Install the APK.** Nothing to sign up for.
2. **Try the 26 bundled words.** Flashcards, quiz and pronunciation all work immediately.
3. **Add your own key** when you want the app to write cards for you — Gemini,
   Anthropic, or any OpenAI-compatible endpoint. Link to Setup.

### 5. Privacy — a short, plain block
- Vocabulary, review history and keys are stored **on the device only**.
- There is **no Polucz server**. The app talks to the provider you configured, directly.
- Translation goes to **DeepL**, with your key, only when you press translate.
- Pronunciation never leaves the phone.
- **Say the trade-off too:** keys are held in the app's local storage. That is the normal
  bring-your-own-key arrangement and it is worth knowing before you paste one in.

### 6. Open source
GPL-3.0 on GitHub. Read it, build it, fork it — a distributed fork ships its source too.
*Link the repo.* This audience checks.

### 7. FAQ
- **Is there an iPhone version?** No, and none is planned right now.
- **Do I need an API key?** Not to study. Only to add and enrich new words, and to translate.
- **What will the key cost me?** Cards are small requests; ordinary use is cents, and you
  are billed by your provider, never by Polucz.
- **Why isn't it on the Play Store?** *(Answer honestly depending on where you land.)*
- **Where do the example sentences come from?** Tatoeba, under CC BY 2.0 FR.
- **Does it work offline?** Studying, yes, entirely. Adding words needs a connection.

### 8. Footer
Download · Setup guide · GitHub · Licence · **Sentences from Tatoeba (CC BY 2.0 FR)** ·
Created & Designed by Thomas Jaglin

> The Tatoeba credit is a **licence obligation**, not a courtesy. It has to appear on the
> site, not only in the app.

---

## Download page

Keep it to one screen.

- **H1:** Get Polucz
- **The button:** Download APK · version and file size beside it, `.apk`, Android 7.0+
- **A short "installing an APK" note**, because most people need it:
  1. Tap the file once it downloads.
  2. Android will ask whether to allow installs from your browser — allow it.
  3. Open Polucz. There is nothing to sign in to.
- **What you get with no key at all:** 26 words, flashcards, the quiz, pronunciation,
  import/export.
- **Checksum** (SHA-256) for anyone who wants it.
- **Then:** "Next: set up your keys →" linking to Setup.

If it does reach Play, this page becomes the badge plus the same expectations text.

---

## Setup page

The page that decides whether someone keeps the app. Write it as a sequence, and let
people stop early — most of it is optional.

- **H1:** Setting up Polucz
- **Opening line:** Everything below is optional. Flashcards, the quiz and pronunciation
  work the moment you install. Keys are for having the app write new cards for you.

**Step 1 — Try it first.** Open the app, tap *Start with 26 common words*. Do a
flashcard round and a quiz. No configuration.

**Step 2 — Choose a provider.** A comparison block, not a wall of prose:

| Provider | Good for | Where to get a key |
|---|---|---|
| Google Gemini | The cheapest way in; generous free tier | aistudio.google.com |
| Anthropic Claude | The best grammar tables in testing | console.anthropic.com |
| OpenAI-compatible | Groq, OpenRouter, Together, or a local model | your endpoint's dashboard |

**Step 3 — Paste the key.** App settings → API → provider, model, key → Save.
*Screenshot the settings card.*

**Step 4 — Add your first word.** Type a Polish word in any form; the app finds the
lemma and writes the card. Show a real before/after.

**Step 5 — Translation (optional).** DeepL is a separate key — free-tier keys end in
`:fx`. Only the translate page uses it.

**Step 6 — Pronunciation.** Uses your phone's voice. If your device has no Polish voice
installed, the app says so and offers the screen to add one.

**Step 7 — Back it up.** Menu → Export JSON writes a file into Downloads. Do it before
changing phones. Import replaces the collection, so keep the file.

**Troubleshooting** — three real ones:
- *"No API key set yet"* when adding a word → the key is missing or was rejected; re-paste it.
- *Polish words are silent* → no Polish voice on the device; App settings offers the fix.
- *The quiz asks for a word without a sentence* → that form has no corpus sentence yet;
  tap **Search the corpus** or let your own LLM write them.

---

## Notes for whoever builds it

- **Show the app, not stock photos.** The screenshots in `assets/landing/` are the product.
- **Light theme leads.** It photographs better on a white site; offer dark mode as a toggle
  and use the `-dark` assets there.
- **One accent.** Violet `#4C2BB8`. The word-type tag colours are the only other hues, and
  they belong only on tags.
- **Do not invent testimonials or user counts.** There aren't any yet, and this audience
  can tell.
- **Every claim on this page is checkable in the repo.** Keep it that way.
