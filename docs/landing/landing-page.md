# Polucz landing page — structure and copy

Three pages: **Home**, **Setup**, **Download**. Copy is written to ship, not to be
replaced with lorem. Every claim here was checked against the app on 2 Sep 2026.

---

## Positioning

**What it is:** a Polish vocabulary trainer for Android where the words are yours —
you meet them in the wild, keep them, and the app fills in the grammar and drills
you until they stick.

**What makes it different, in one line:** *it does not want your account.* No
sign-up, no server, no subscription. Your vocabulary lives on your phone. The
language features run on an API key you supply, so you are your provider's
customer, not Polucz's.

**Who it is for:** people already learning Polish — living there, married into it,
studying it — who keep a word list and are tired of decks written by someone else.

**Do not oversell.** Android-only, one person's app, and adding new words needs a
key. Saying that plainly is more persuasive than hiding it, and this audience will
notice either way.

**What we no longer say.** The old draft led with a proof strip — 124,433 corpus
sentences, 26 bundled words. That has been cut. A page arguing *your list, not
someone else's deck* cannot open by bragging about deck size; it argues against
itself. The numbers also went stale within a month.

---

## Navigation

`Logo · How it works · Setup · Download · GitHub`

The logo is the app mark (`assets/icon-only.png`, or the SVG at
`public/logo-mark.svg` for crispness). Setup is promoted into the nav: it is the
one thing standing between someone downloading this and it being useful.

---

## Home

### 1. Hero

- **Eyebrow:** Polish vocabulary, on your terms
- **Headline:** **The words you actually need, drilled until they stick**
- **Sub:** You come across a Polish word. Polucz fills in the translation, the
  full declension or conjugation, and real example sentences — then schedules it
  for review, quizzes you on every form, and reads it aloud.
- **Primary CTA:** Download for Android · **Secondary:** How it works
- **Under the buttons, small:** Free · No account · Your words stay on your phone
- **Visual:** the app mark, then `screen-list-light.png` in a phone frame with
  `card-light.png` and `filter-pane-light.png` floating out at the edges.

### 2. The loop — the walkthrough section

This replaces the numbers strip and is the most important section on the page.
It shows *why the app exists* rather than listing what it has. The app's own
guided tour ends on the line this section is built around:

> **Find a word. Keep it. Learn it.**

Eight panels, comic-strip layout, each a step. Panels 1–2 are the "in the wild"
moment; 3–6 are the app; 7–8 are the payoff.

| # | Panel | Caption |
|---|---|---|
| 1 | Polish text in the wild — a comic panel, a sign, a message | You are reading something Polish and one phrase stops you. |
| 2 | The phrase highlighted, being copied | Highlight it. Copy it. |
| 3 | Translate page, phrase pasted in | Paste it into Polucz. |
| 4 | Translate page, English shown | Tap Translate. Now you know what it said. |
| 5 | The identified words listed underneath | Polucz picks out the individual words — not just the sentence. |
| 6 | Adding two of them | Keep the ones worth keeping. |
| 7 | Vocabulary list, the new cards in it | They are in your list, grammar already filled in. |
| 8 | A flashcard mid-review | And now you are learning them. |

**Artwork note.** Panel 1 needs original or properly-licensed art. The mockup used
a Dragon Ball page, which cannot ship — it is Shueisha's. Either commission the
style, use a public-domain comic, or make the source text something ownable: a
café menu, a station sign, a message from a friend. A message thread may in fact
be the most relatable of the three.

**Closing line under the panels:** That is the whole loop. Everything else in the
app serves it.

### 3. Features

Shorter than before — the loop above already carries the story. Four blocks,
alternating sides.

**a. Your list, not someone else's deck**
Type a word, or mine it from a sentence; the app writes the card. Translation,
part of speech, and the full grammar table — seven cases singular and plural for a
noun, every person for a verb, all five gender-and-number columns for an adjective.
*Asset:* `word-detail-light.png` — the `trudny` table, the single most convincing
image on the page. Cut-out, no phone frame.

**b. Spaced repetition that knows what "hard" means**
Swipe through cards and the schedule adapts. Hard mode turns the screen red so you
know what you asked for. Words you have genuinely mastered are retired on purpose,
not by accident — and they get a holographic card when they are.
*Asset:* `screen-flashcards-light.png`

**c. A quiz built from your own words**
Fill in the blank and multiple choice, drawn from the exact forms of the words you
added. Questions come from three sources: real sentences from a bundled corpus,
sentences written by your own LLM, and the grammar tables themselves — that last
one needs no key and no network at all.
*Asset:* `quiz-modes-light.png`, cut-out.

**d. Hear it out loud**
Pronunciation uses your phone's own speech engine. No key, no network, no waiting.
Prepare a word once and it plays back in the audio tab as a listening drill —
useful on a commute with the screen off.
*Asset:* `screen-audio-light.png`

### 4. Privacy — short, plain, and accurate

> **This section was factually wrong in the first draft** and must not regress. The
> old copy said translation goes to DeepL and *"nothing else is sent"*. Untrue: the
> LLM provider receives words and sentences, and Tatoeba receives search queries.
> The wording below matches `PRIVACY.md`. Change them together or not at all.

**Stays on your device.** Your vocabulary, review history and API keys are stored
on your phone. There is no Polucz server and no account.

**What does leave, and when.** Three destinations, only ever with a key you set up:
the AI provider you chose gets the word or sentence being looked up; DeepL gets the
text you asked to translate; Tatoeba gets a single word as a search query, with no
key and nothing identifying you. With no keys configured the app makes no network
request at all.

**The trade-off, stated plainly.** Keys live in the app's storage on your phone.
That is the normal bring-your-own-key arrangement: usage is billed to your account
with that provider, and a key is as safe as the device holding it. Worth knowing
before you paste one in.

*Link:* Read the full privacy policy →

### 5. Open source

Open source under GPL-3.0. The source is on GitHub, and a fork that gets
distributed ships its source too. If you would rather check the privacy claims
than take them on trust, every network call the app makes is in one file.

*Link:* github.com/thomasjaglin/polucz

### 6. FAQ

**Is there an iPhone version?**
No, and none is planned. Pronunciation uses Android's own speech engine, so the
core feature would need rebuilding rather than porting.

**Do I need an API key?**
To study, no. Flashcards, quizzes and pronunciation work without one. You need a
key to add new words and have the app fill in translations and grammar.

**What does a key cost?**
Each lookup is a small request billed by your provider. Ordinary use runs to cents
a month. Polucz has no subscription and takes no cut — it never sees your key.

**Where do the example sentences come from?**
Tatoeba, under CC BY 2.0 FR. The licence requires attribution, which is why it
appears in the app and in the footer here.

**Does it work offline?**
Studying does, entirely — flashcards, quizzes, pronunciation and browsing use no
network, and the app bundles its own fonts so nothing is fetched at launch. Adding
new words needs a connection and a key.

**Is my vocabulary backed up anywhere?**
Only where you put it. Export writes a JSON file to your Downloads folder whenever
you ask; import reads it back on a new phone. There is no cloud sync, which means
nothing to breach and nothing to lose access to.

### 7. Footer CTA

**Ready to start?** Free on Android. No account, no subscription, no ads.
Download for Android →

---

## Setup page

Promoted to the main nav. Someone who cannot get a key working has a study app
with no way to add words, so this page matters more than its length suggests.

### Opening

Polucz asks you for two keys, and they do different jobs. You can add either one
first, or neither — the app works without both, just with less in it.

### What works with no key at all

Browsing your words · flashcards · quizzes · pronunciation · export and import.
If you never add a key, Polucz is still a working trainer for words you enter
by hand.

### Key 1 — the language model. What it unlocks

Writing a card for a new word: the translation, the part of speech, the full
declension or conjugation table, and example sentences. Three options:

| Provider | Model to enter | Where to get the key |
|---|---|---|
| **Google Gemini** | `gemini-3.5-flash` | Google AI Studio → Get API key. Has a free tier. |
| **Anthropic Claude** | `claude-opus-5`, `claude-sonnet-5` or `claude-haiku-4-5` | Anthropic Console → API keys. Pay-as-you-go. |
| **OpenAI-compatible** | whatever the service calls it | Anything that speaks the OpenAI API — Groq, OpenRouter, Together, or a local Ollama. You also give the base URL, e.g. `https://api.groq.com/openai/v1`. |

Haiku or Gemini Flash are the sensible defaults: this is short structured work, not
an essay, and the cheap models do it well.

*Screenshots to supply:* the provider's key page, key visible-but-redacted.

### Key 2 — DeepL. What it unlocks

The Translate page: pasting Polish in and getting English out, with the individual
words picked out so you can keep them. This is the sentence-mining loop, so it is
the one most people want first.

DeepL's API has a free tier. Sign up for **DeepL API Free**, and take the key from
your account page. Free keys end in `:fx` — Polucz notices that and routes to the
free endpoint automatically, so you paste the key and nothing else.

*Screenshots to supply:* DeepL account page with the key area.

### Where the keys go in the app

1. Open Polucz and tap the gear, top right
2. **App settings**
3. **API** — pick your provider, choose the model, paste the key, **Save configuration**
4. **Translation** — paste the DeepL key, **Save DeepL key**

Keys are stored on your phone. The app shows a fixed-length mask afterwards rather
than the key itself — deliberately fixed-length, since the real length would hint
at which provider it is. You can clear either key with the bin icon beside it.

*Screenshots to supply:* App settings, API section; App settings, Translation
section; the saved/masked state.

### If something is not working

**"Translation needs a DeepL key"** on the translate page — the DeepL key is
missing or was not saved. The button stays disabled until one is stored.

**Cards save but stay empty** — the LLM key is missing, wrong, or the model name is
not one that provider offers. Polucz only lists models it has verified; a typo in a
custom model name comes back as a 404.

**Nothing is spoken** — your device has no Polish voice installed. App settings
shows a Pronunciation section when that is the case, with a button through to
Android's speech settings.

---

## Download page

**APK only, for now.** Play is coming but not yet, and the site should not promise
a store listing that does not exist. Revisit when Play's requirements are met.

### Copy

**Download Polucz** · Free, no account, no ads.
`Polucz-1.0.0.apk` · version and file size · SHA-256 so you can verify it

**Installing an APK** — Android will ask whether to allow installs from this
source, because the file did not come from the Play Store. That prompt is normal
and you can turn the permission back off afterwards.

1. Download the APK
2. Open it — Android asks about installing from this source, allow it
3. Install, open, and the app offers you a guided tour

**On the Play Store:** Not yet. It is coming; this page will change when it does.

**Requirements:** Android 7.0 or later.

---

## Notes for whoever builds it

- Fonts are **bundled, not fetched**. The app stopped loading Google Fonts at
  launch and the site should match — a privacy policy one click away makes a CDN
  font request look careless.
- The captured assets give glass an explicit frosted fill, because glass has
  nothing to sample on a transparent canvas. They sit well on soft backgrounds and
  badly on busy photos.
- Both themes exist for every asset. The site follows the system theme, as the app
  does.
- Reuse the app's real tokens rather than re-deriving them. `--ink`, `--accent`,
  `--page-bg` and the ease curves all come from `src/index.css`.
