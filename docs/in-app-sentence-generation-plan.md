# In-app sentence generation — plan

Moving the quiz-sentence pipeline off the developer's Mac and into the app, so a
user's quiz is built from *their* vocabulary with *their* key.

No code here. This is the shape of the work and the decisions it needs.

---

## 1. What exists today

Three separate things, none of them on the phone:

| Piece | Where | What it does |
|---|---|---|
| `scripts/generate-sentences.js` | Node, on your Mac | Reads a backup, enumerates grammatical forms, asks Gemini for 3 candidate sentences per form, validates each against a local LanguageTool, writes the first passing one |
| LanguageTool | Docker container on `localhost:8010` | Rejects candidates with grammar/spelling errors |
| `tools/review.html` | A local HTML page | Swipe-approve each sentence, export an approved-only file |

The result is committed as `public/approved-sentences.json` and pulled in by
**Sync sentences** in the settings menu.

### The numbers, from your actual vocabulary

- **761 cards** → **4,477** enumerable forms (nouns 4 cases × 2 numbers, verbs 6
  present-tense persons, adjectives 3 genders)
- **1,541** sentences exist — **34% coverage**, across **251 of 761 cards**
- All 1,541 are approved
- 47 cards are type `unknown` and produce nothing; 2 are unenriched

So roughly **2,900 forms have never been generated**.

---

## 2. Why a straight port fails

Porting the script into the app and adding a "Generate" button does not work, for
five separate reasons.

**Scale.** 2,900 remaining forms at one LLM call each. Measured on your device
this session: lemmatize 4.6s, enrich-card 10.6s. At ~6s a call that is **four to
five hours** of continuous requests, on the user's own key and quota.

**LanguageTool cannot exist on the phone.** It is a JVM service in a Docker
container. There is no on-device equivalent.

**The approval step is a separate desktop tool.** Nothing in the app can approve
a sentence, and `quizLogic` filters `!s.approved` — so unapproved sentences are
invisible to the quiz.

**The WebView is killed when backgrounded.** A long job cannot run while the user
does something else. This is exactly how the old prepare-audio batch failed: its
progress lived in memory and vanished.

**Storage is already near its comfortable limit.** `polucz_sentences` is 557 KB
of synchronous localStorage today; full coverage would be roughly 1.6 MB, parsed
on the main thread every time the quiz page mounts.

---

## 3. The reframe

**Stop thinking in batches over a vocabulary. Generate per card, on demand.**

The unit of work becomes **one card**: 6 forms for a verb, up to 8 for a noun,
3 for an adjective. Bounded, explicable, and finishable in under a minute.

### One call per card, not one per form

The script makes a separate call for each form. Instead, send the card's whole
paradigm in one request and ask for one sentence per form.

- 4,477 calls → **~761 calls**, a ~6× cut in both latency and quota
- The remaining ~510 ungenerated cards become roughly **an hour**, not five
- A single card becomes ~8 seconds — fast enough to be an interactive action

**The risk this introduces:** with 8 forms in one response, the model can pair a
sentence with the wrong form. Mitigation: require each returned item to echo the
form it used, then verify that string against the paradigm locally and discard
mismatches. Re-request only the discarded forms individually. This turns a
correctness risk into a cost risk, which is the right trade.

### Three ways work gets requested

1. **From the word modal** — "Generate quiz sentences" on a card the user is
   already looking at. Explicit, immediate, ~8s.
2. **From the quiz selector** — when there aren't enough eligible sentences,
   offer to generate for the cards most due for review. `quizLogic` already
   weights by SRS ease; reuse that ordering so generation follows what the user
   is actually struggling with.
3. **An optional bulk queue** — bounded, cancellable, visible progress, running
   only while the app is foregrounded.

Most users should never need (3). It exists for the case you have now: an
established vocabulary with two-thirds of it ungenerated.

---

## 4. Replacing LanguageTool

This is the decision with the least comfortable answer. Four candidates:

**a. The public LanguageTool API** (`api.languagetool.org`). Free, no key — but
rate-limited to roughly 20 requests/minute per IP, and its terms discourage
sustained automated use. At ~8 checks per card that caps the whole feature at
~2.5 cards/minute, which is slower than the LLM it is meant to be validating.
Not viable as the default.

**b. A user-supplied LanguageTool endpoint.** A field in App settings. You, and
anyone self-hosting, point it at an instance; everyone else skips validation.
Cheap to build, honest, and it preserves the current quality for the one person
who has the container running.

**c. A second LLM pass.** A different prompt asking whether the sentence is
grammatical and natural. Weak — the same model that wrote it is grading it — and
it doubles the cost.

**d. Local deterministic checks.** Free, instant, no dependency:

- the exact target form appears, matched on word boundaries, case-insensitively
- word count within the 8–12 band the prompts already ask for
- ends with terminal punctuation; isn't a title, list item, or quotation
- doesn't merely restate the English gloss
- isn't a duplicate of a sentence already stored for that card

**Recommendation: (d) always, (b) optional, drop the hard dependency.**

The honest framing: this is *weaker* validation than the script has. But look at
what each check is worth for a fill-in-the-blank quiz. The failure that destroys
a question is **the target form not appearing** — and that is precisely what the
deterministic check catches, with certainty, which LanguageTool never did. A
clumsy adjective elsewhere in the sentence costs far less.

---

## 5. Does approval still make sense?

`approved: false` is the current gate. It exists because the author was curating
a dataset **to ship to other people**. When a user generates from their own
vocabulary with their own key, that asymmetry disappears: a mediocre sentence
costs one skipped question, not a shipped defect.

**Recommendation: locally-generated sentences enter the quiz immediately**, with:

- a one-tap **"bad sentence"** reject inside the quiz, which deletes it and can
  optionally re-generate that form
- an **optional review screen** for anyone who wants to curate up front — a
  swipe UI, reusing the flashcard idiom, showing the target form highlighted

Keep the `approved` field: it still distinguishes curated bundled data from
locally-generated data, and flipping the default is a one-line policy change if
this turns out to be wrong.

**The counter-argument, stated fairly:** the spec's "nothing enters the app until
you explicitly approve it" was a deliberate quality stance, and auto-approval
does mean a user can meet a bad sentence. The mitigation is that rejection is one
tap away at the exact moment they notice.

---

## 6. Storage

Move sentences from localStorage to IndexedDB.

- 557 KB today, ~1.6 MB at full coverage, in a synchronous store that also holds
  vocabulary (162 KB) and reviews (28 KB)
- `getSentences()` parses the entire blob; `QuizPage` calls it on mount
- IndexedDB keyed by sentence id, indexed on `cardLemma` and `cardType`, lets the
  quiz select without loading everything
- `audioCache.ts` is the existing pattern to follow
- One-time migration on boot, like `storageMigration.ts`

### A bug to fix as part of this

**Export does not include sentences.** `buildPayload()` returns `{version, cards,
reviews}` — import accepts `sentences` but export never writes them. Today that
merely loses regenerable data. Once sentences are generated in-app with the
user's own key and time, they become user-created data that a backup must carry.

---

## 7. The bundled file

`public/approved-sentences.json` is 688 KB inside the APK, and **Sync sentences**
loads it. It contains *your* 1,541 sentences for *your* vocabulary. Any other
user gets a quiz about words they have never studied — the distractor logic falls
back to cross-word forms and the quiz still runs, but it is asking about someone
else's word list.

Once generation is in-app:

- drop it from the bundle (−688 KB APK), and
- have the quiz's empty state offer generation instead — consistent with the
  vocabulary empty state, and the same "one action" rule

Your own 1,541 sentences travel with you in your backup, not in the bundle.

---

## 8. Lifecycle, resumability, consent

- **Persist progress after every card**, never in memory. The prepare-audio batch
  lost its place on background; do not repeat that.
- **Pause on background, resume on return** via `@capacitor/app`'s
  `appStateChange` — already installed for the back button.
- **A per-card done marker**, so a resumed run skips completed work. This is the
  script's `done` set, made durable.
- **Estimate before a bulk run**: "510 cards, about one call each, roughly an
  hour." The user is spending their own quota.
- **Cancellable, capped per session, and never automatic.**

---

## 9. What is already built

Worth knowing before anyone starts:

- `generateJson()` in `src/lib/llmClient.ts` already handles Gemini, Anthropic
  and OpenAI-compatible, with `strictify()` applied per provider. Generation
  needs **no new provider plumbing** — only new prompts and schemas.
- `shared/llmTasks.js` is the established home for prompts and schemas.
- The script's three system prompts are good and transfer nearly unchanged; they
  need rewording from "one form" to "this paradigm".
- The progress-pill UI pattern exists in `TopHeader` (removed for audio, where
  the work was fake — here it is real).

---

## 10. Phasing

**Phase 1 — per-card generation.** Word modal action, one call per card,
deterministic validation, IndexedDB move, export fix. Delivers real value with no
queue and no background work. This is the phase that matters.

**Phase 2 — quiz top-up.** From the quiz selector, generate for the N most-due
cards. Makes the feature self-serving without the user thinking about it.

**Phase 3 — bulk queue.** Progress pill, resumability, cancel, estimate. Only
worth it for an established vocabulary like yours.

**Phase 4 — optional extras.** LanguageTool endpoint setting; review screen;
drop the bundled file.

---

## 11. Open questions

1. **Auto-approve, or review first?** Recommendation in §5, but it is a stance,
   not a fact.
2. **Do adjectives deserve more than nominative singular?** v1 covers 3 genders
   only. In-app generation makes widening cheap — but multiplies the form count.
3. **What happens to unenriched cards?** Generation needs the paradigm table, so
   enrichment must come first. Should the action enrich-then-generate, or refuse
   with an explanation?
4. **Should a rejected sentence auto-regenerate?** Convenient, but it spends the
   user's quota on a tap that reads as "delete".
5. **Do the 47 `unknown`-type cards ever get quiz coverage?** They produce no
   forms today and would stay invisible.

---

## 12. What this does not fix

- Quality without LanguageTool is lower. Stated plainly, not hidden.
- Generation cost is real and falls on the user's key.
- None of this is testable without tests, and the scheduler, storage and adapter
  schemas still have none. A generation bug that writes malformed sentences would
  be silent.
