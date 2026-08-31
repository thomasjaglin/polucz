# Tiered quiz-question generation — implementation plan

Building quiz questions from the user's own vocabulary, on the device, by trying
the cheapest and most accurate source first.

No code here. This is what to build, in what order, and how to prove each step.

Supersedes the batch approach in `in-app-sentence-generation-plan.md` §3, which
this replaces with a source ladder. Read that document first for why the batch
script cannot be ported.

---

## 1. The ladder

For any grammatical form we want to test, try in order:

| Tier | Source | Cost | Accuracy | Coverage |
|---|---|---|---|---|
| **1** | Tatoeba — a real sentence containing that exact form | free | human-written | **67% measured** |
| **2** | The user's LLM — generate a sentence for the form | user's quota | needs verification | the remainder |
| **3** | Paradigm drill — no sentence, ask for the form directly | free | equals the card's own data | **100%, always** |

Tier 3 is not a failure state. It is a complete, valid question that works with
no network, no key and no generation, and it is the reason the quiz can work for
a brand-new user on their first day.

### The evidence

Measured against the real 761-card vocabulary:

- **761 cards → 4,477 enumerable forms** (nouns 4 cases × 2 numbers, verbs 6
  present persons, adjectives 3 genders)
- Searching Tatoeba **per lemma** covers only **6%** of forms, and every hit is
  the lemma itself — the search matches the query string, so `łóżko` never
  returns `łóżku`
- Searching Tatoeba **per inflected form** covers **67%** (12 of 18 sampled),
  with sentences like *Miałem ból głowy* (genitive), *Potrząsnął głową*
  (instrumental), *Wygląda młodo* (3rd person singular)
- The 33% that miss are the rare long tail — `wyrzutek`, `demon`, `oblać` —
  which is exactly where paying for generation is worth it

**Searching per form, not per lemma, is the whole idea.** It is the difference
between 6% and 67%.

---

## 2. Fixes the existing quiz needs first

These are prerequisites, not improvements. Tiers 1 and 3 both break without them.

### 2.1 `blankSentence` blanks substrings

It builds a global case-insensitive regex from the target form with no word
boundaries. Target `dom` in *W domu mieszka* yields *W ___u mieszka* — the blank
leaks the answer's stem and mangles the sentence.

This is largely hidden today because generated sentences were prompted to use
the exact form, usually standalone. **Corpus text has no such guarantee**, so
Tier 1 makes this fire regularly.

Fix: match on Unicode letter boundaries rather than `\b`, which is ASCII-only and
mis-handles `ł`, `ó`, `ż`. Guard the form with lookarounds for "not preceded or
followed by a letter", with the Unicode flag.

**Verify:** target `dom` against *W domu mieszka mój dom.* must blank only the
final word.

### 2.2 Questions must render without a sentence

Tier 3 has no sentence. Both question components currently assume one and call
`blankSentence`.

`grammarPrompt` already produces the full instruction — *Genitive singular of
"głowa"* — so a paradigm question needs only for the sentence line to be omitted
when absent. Small conditional in `DeclensionQuestion` and `ConjugationQuestion`.

### 2.3 Distractors must not contain a second correct answer

Polish syncretism means one string fills several cells: `głowy` is genitive
singular *and* nominative plural. If a distractor happens to be a string that is
also correct, the question has two right answers.

`getDistractors` already dedupes by normalised form against `seen`, which covers
the common case. **Verify deliberately** with a syncretic noun rather than
assuming — this is a correctness property, not a nicety.

---

## 3. Data model

### 3.1 One record per question

Keep `SentenceEntry`'s existing shape and discriminated union. Add:

- **`source`** — `'corpus' | 'generated' | 'paradigm'`. Drives the tier a record
  came from, what the UI can say about it, and what to re-try if rejected.
- **`polish` / `english` become optional** — a `paradigm` record has neither.
- **`sourceRef`** — for corpus records, the Tatoeba sentence id, so a sentence
  can be traced or re-checked later.

`approved` stays. `languageToolPassed` becomes meaningless for new records;
leave it on existing data and stop writing it.

### 3.2 A form is identified by its slot

The script's `makeKey` already defines this: lemma + type + case/number, or
lemma + pronoun, or lemma + gender. Reuse it unchanged as the identity of a
*form*, so a record can be looked up, replaced or upgraded in place.

**Upgrade in place matters**: a form answered by Tier 3 today should be
replaceable by a Tier 1 sentence later, without duplicating the question.

### 3.3 Storage

Move sentences from localStorage to IndexedDB, as set out in the previous plan
(§6). Two additional stores:

- **`corpusCache`** — keyed by exact form string, holding the sentences found and
  **a negative marker when none were found**, with a timestamp. Without negative
  caching every quiz session re-queries the same 33% that will never hit.
- **`formStatus`** — keyed by the §3.2 slot key: which tier has answered it, when
  it was last attempted, and how many times a generation attempt failed.

---

## 4. Tier 1 — corpus

**Revised after implementation.** Phase 2 was built against the live search API,
then measured. The measurements say to use the offline corpus export instead.

### What the live API costs

`tatoeba.org/en/api_v0/search`, one request per inflected form, works — but its
latency swings from **0.3s to over 10s** for identical queries. A 6s client
timeout turned that variance into apparent refusals, which is what the first
implementation reported as "the corpus is not responding".

At 10s a lookup, a single card is up to 80 seconds and any bulk pass is
impossible. It also puts sustained load on a volunteer service for data that is
published for download precisely so tools do not have to do that.

### What the offline export costs — measured

Tatoeba publishes weekly per-language exports, and states plainly that bulk
download is the intended path for language tools.

| | |
|---|---|
| `pol_sentences.tsv.bz2` | **1.74 MB** compressed, 6.6 MB raw, **137,150 sentences** |
| `pol-eng_links.tsv.bz2` | **0.52 MB** compressed |
| Download time | **0.6s** |
| Index build | **0.5s** for all 137,150 |
| Licence | CC BY 2.0 FR — **attribution required** |

Coverage against the real vocabulary, over every form rather than a sample:

- **3,784** distinct forms wanted (fewer than the 4,477 slots, because
  syncretism means slots share strings)
- **2,031 covered — 54%**, median **7** sentences per covered form

The earlier 67% came from an 18-form sample skewed toward common words. 54% is
the real figure.

### English translations are not worth their price

`eng_sentences.tsv.bz2` is **24.85 MB** — eleven times the Polish data. And
requiring a translation *reduces* coverage to **1,738 forms (46%)**, because
only 78,570 of the 137,150 Polish sentences are linked to English.

So: ship Polish only. `english` is already optional on the record, and the
declension question omits the translation line when it is absent. An 8-point
coverage gain and a 92% smaller download both argue the same way.

### The design that follows

1. **Download the snapshot once**, on an explicit action, over ~2.3 MB.
2. **Build an inverted index** form → sentence ids, in memory or IndexedDB.
   Half a second for the whole corpus.
3. **Every lookup is local**: instant, offline, no latency variance, no rate
   limit, no politeness budget, and no need for a negative cache — a form either
   is in the snapshot or is not, and that answer is free to recompute.
4. **Re-download occasionally**, since exports refresh weekly. Nothing breaks if
   the snapshot is stale.
5. **Attribute Tatoeba** wherever corpus sentences are shown. CC BY 2.0 FR
   requires it, and it is the right thing regardless.

This deletes most of §4's original complexity: the pacing, the concurrency cap,
the negative-cache TTL, and the stop-after-three-refusals rule all existed to
manage a network dependency that no longer exists per lookup.

**What the live API is still good for:** nothing this app needs. It is not worth
keeping as a fallback for the 46% the snapshot misses — those forms fall to
tier 2 or tier 3, which is what the ladder is for.

---

## 5. Tier 2 — LLM generation

Only for forms Tier 1 did not answer.

**One call per card, for the missing forms only.** Send the card's paradigm with
each missing slot labelled; ask for one sentence per slot. The prompt is the
script's `SYS_NOUN` / `SYS_VERB` / `SYS_ADJ` reworded from one form to a set;
those prompts are good and should not be rewritten from scratch.

**Each returned item must echo the form it used.** Verify that string against the
paradigm locally and discard mismatches. With several forms in one response the
model can pair a sentence with the wrong slot, and this is the only way to catch
it without a human. Re-request discarded slots individually, once.

**Provider support is already built.** `generateJson()` in `src/lib/llmClient.ts`
handles Gemini, Anthropic and OpenAI-compatible with `strictify()` applied per
provider. Add prompts and schemas to `shared/llmTasks.js`; add no provider code.

**No key configured** → skip Tier 2 entirely and fall to Tier 3. Generation must
never be the thing that makes the quiz unavailable.

---

## 6. Tier 3 — paradigm drill

Needs no sentence, no network and no key: the card's own declension or
conjugation table already holds the answer.

- The prompt is `grammarPrompt`, which exists
- The answer is the table cell
- Distractors come from the same paradigm and from other cards, which
  `getDistractors` already does

**This tier should be built first.** It makes the quiz work for every enriched
card immediately, at zero cost, and it is the fallback everything else leans on.

---

## 7. Validation, in two layers

Validation splits by what the device can actually do. Nothing here depends on
LanguageTool being reachable from the phone — it is not, and §8 explains why.

### Layer 1 — on device, always, free

Applied to every record before it is stored, regardless of tier:

1. the target form appears as a whole word (§2.1 matching)
2. exactly once
3. the sentence is within the length band
4. it ends with terminal punctuation and is not a title, list item or bare quote
5. it is not a duplicate of a sentence already stored for that card
6. for generated records, the echoed form matches the requested slot

These are weaker than LanguageTool at grammar and **stronger at the failure that
actually breaks a question** — the target form not being present. Say exactly
that in any user-facing copy; do not imply grammatical validation.

Evidence for both halves of that claim, found while running phase 4 over the
real vocabulary:

**What they catch that LanguageTool did not.** Two stored questions did not
contain their own target form, so they could not be blanked and would show no
gap. Both were enrichment errors rather than sentence errors — `wyjście`
carrying the malformed genitive plural `wyść` against a sentence with the
correct `wyjść`, and `dziecko` carrying `dzieckem` against `dzieckiem`.
LanguageTool passed them because the sentences are perfectly grammatical.

**What they cannot catch: homographs.** A corpus sentence matched on string, not
on grammatical form:

> *W klasie zostawiono ___ aparat.* — asked as "accusative plural of *droga*"

`drogi` is both the accusative plural of *droga* (road) and the masculine
adjective *drogi* (expensive). The sentence contains the string but demonstrates
the adjective. The question stays answerable and the answer stays correct, so
this is a quality wart rather than a correctness failure — but the sentence does
not show what it claims to.

Detecting this needs part-of-speech tagging, which is exactly what dropping
LanguageTool gave up. It is the clearest argument for the two optional
mitigations: a bundled Polish dictionary (§14 decision 6) would not help, since
`drogi` is a real word either way, but **the desktop curation tool (§8) would**,
because LanguageTool tags parts of speech. Worth weighting when deciding how
much the curation pass matters.

**Optional addition, not yet decided:** `nspell` + `dictionary-pl` bundles
offline Polish spell checking into the web build for about 5 MB of pure
JavaScript, no native code and no network. It covers the `misspelling` half of
what the desktop script rejects on, catching invented words and typos. It will
not catch a wrong case ending, and it false-positives on proper nouns, so it
should rank candidates or require several unknown tokens rather than hard-reject
on one. See §14.

### Layer 2 — the desktop curation tool, optional

Real grammar analysis, run on a Mac against the full LanguageTool rule engine.
Described in §8. **The app is completely usable without it** — it is a quality
pass, never a dependency.

---

## 8. The desktop curation tool

### Why it exists

A phone cannot run LanguageTool. It is a JVM service, there is no Android build,
and the free public API **prohibits automated requests** — self-hosting or an
enterprise account are the documented alternatives. Pointing the app at a
self-hosted instance was considered and rejected: Android blocks cleartext HTTP
by default, so a LAN server at `http://192.168.1.20:8081` is refused by the
platform before the request leaves the device, and the ways around that are
either app-wide cleartext (weakens every request) or making the user front
LanguageTool with TLS.

So grammar validation stays on the desktop — but its job changes.

### The job changes: generator → validator

Today `scripts/generate-sentences.js` generates *and* validates. Once the app
generates its own questions, desktop generation is redundant. What a laptop can
do that a phone cannot is grammar analysis, so the tool should do only that.

The flow becomes:

> generate in the app → export → curate on the Mac → import back

This is far cheaper than the current run:

- **no LLM calls on the desktop** — no API key there, no cost, no hours-long run
- **Tier 1 corpus sentences are skipped** — a human wrote them
- **Tier 3 paradigm records have nothing to check** — there is no sentence
- **only Tier 2 `generated` records are checked**, roughly a third of forms
- **LanguageTool is local**, so no rate limit — thousands of checks in minutes
- **only flagged sentences are reviewed**, not all of them

Today every one of 1,541 sentences is swiped through by hand. Under this, only
what LanguageTool flags is.

### Setup — Docker is no longer needed

Homebrew ships LanguageTool 6.8, depending only on a JDK:

```
brew install languagetool
brew services start languagetool     # port 8081, restarts at login
```

That replaces Docker Desktop, the container and the manual `docker run`. Note the
port differs from the script's current default of 8010.

### Behaviour

- **Input**: the newest `polucz-backup-*.json` in `~/Downloads`, found
  automatically — no path argument. The app's export already lands there in one
  tap.
- **Scope**: records with `source: 'generated'` only.
- **Check**: `POST /v2/check` with `language=pl`, rejecting on `issueType` of
  `grammar` or `misspelling` — the same filter the script uses today.
- **Review**: a local page showing **only flagged sentences**, with the offending
  span highlighted and LanguageTool's explanation. Approve, reject, or edit in
  place. `tools/review.html` already has the swipe UI, so this is a rework rather
  than a rewrite.
- **Rejection feeds back**: a rejected record is removed and its slot marked in
  `formStatus` (§3.3), so the app can re-attempt it from another tier rather than
  silently losing the question.
- **Output**: written back to `~/Downloads`, ready to share to the phone.

### The constraint that dictates the output format

The app's import **replaces** everything — `replaceAllCards`,
`replaceAllReviews`, `saveSentences`. So the curated file must be a **complete
backup with the sentences amended**, never a sentences-only diff. Importing a
partial file would wipe the vocabulary.

This also depends on export including sentences, which it currently does not —
see `in-app-sentence-generation-plan.md` §6. That fix is a prerequisite for the
round trip, not an optional extra.

### One command

`npm run curate` replaces the current invocation with its environment variable,
its `--input` path and its separate review page. Three moving parts — Docker, the
CLI script, a standalone HTML page — collapse to one command plus a background
service.

---

## 9. Selection at quiz time

`getSessionQuestions` already samples with SRS-ease weighting. Extend it to:

- draw from all three sources, preferring sentence-based records over paradigm
  ones for the same form, so a session reads as varied rather than mechanical
- cap how many paradigm-only questions appear in a session, so a user with no
  key still gets a quiz but a user with sentences sees them
- keep the existing weighting untouched — it is the part that makes the quiz
  follow what the user is struggling with

---

## 10. Where the user meets this

- **Quiz selector** — replaces "N sentences available" with what is actually
  ready, and offers to improve coverage for the most-due cards. One action.
- **Word modal** — "Improve quiz questions for this word", showing what each
  tier found. Bounded, explicit, a few seconds.
- **Quiz** — a one-tap reject on a bad question, which deletes the record and
  marks the slot for another attempt from a different tier.
- **Empty state** — if the user has cards but no questions, Tier 3 means there is
  always something to offer. The quiz should never be empty for an enriched
  vocabulary.

No automatic generation, ever. Every call spends the user's quota or a volunteer
service's capacity.

---

## 11. Lifecycle and cost

- Persist after **every form**, not every card; the WebView is killed when
  backgrounded and in-memory progress is lost — the prepare-audio batch's exact
  failure
- Pause on background and resume on return via `@capacitor/app`'s
  `appStateChange`, already installed
- Show an estimate before any bulk run, in cards and minutes
- Cancellable, capped per session

**Rough costs**, from the measured numbers: a single card is ~8 corpus lookups
plus at most one LLM call, roughly 15 seconds. The 510 cards with no questions
today would be around two hours — slower than pure generation, but two-thirds of
it free and human-written.

---

## 12. Build order

**Phase 1 — Tier 3 and the prerequisites.** §2.1, §2.2, §2.3, plus paradigm
questions and the storage move. No network, no key, no generation. At the end of
this phase the quiz works for all 759 enriched cards for the first time.

**Phase 2 — Tier 1.** Corpus lookup, verification, per-card action in the word
modal. **Partly built against the live API and now superseded by §4's offline
export** — the verification, storage, dedupe and UI all carry over; the
per-form network lookup, its pacing and its negative cache do not.

**Phase 3 — Tier 2.** LLM fill-in for missing slots, echo verification, retry.

**Phase 4 — coverage tools.** Quiz-selector top-up, bulk queue with progress and
resumability, reject-and-retry in the quiz.

**Phase 4b — retire the bundled sentence file.** Delete
`public/approved-sentences.json` (688 KB of the author's sentences for the
author's vocabulary, shipped to every user) and the **Sync sentences** menu item
that loads it. Safe from Phase 1 onward, since the paradigm tier means the quiz
no longer needs seeded data — but do it after Phase 2 so users have a path to
sentence-based questions before the seeded ones disappear. Rationale in
`in-app-sentence-generation-plan.md` §7.

**Phase 5 — the desktop curation tool (§8).** Repoint
`scripts/generate-sentences.js` from generating to validating, move LanguageTool
from Docker to the Homebrew service, rework `tools/review.html` to show only
flagged sentences, and expose it as `npm run curate`.

**Prerequisite for Phase 5:** export must include sentences
(`in-app-sentence-generation-plan.md` §6). Without it the curated file cannot
round-trip, because import replaces everything it is given.

Phase 1 is independently shippable and is most of the user-visible value.
Phase 5 is deliberately last: until the app generates its own questions, the
desktop tool still has to generate, and it would be doing two jobs at once.

---

## 13. How to prove each phase

- **§2.1** — `dom` against *W domu mieszka mój dom.* blanks only the last word
- **§2.3** — a syncretic noun never produces a second correct option
- **Phase 1** — a fresh install with cards but no sentences yields a full quiz
- **Phase 2** — on device, a card's forms resolve against the corpus and the
  cache prevents a second round of requests; measured hit rate near 67%
- **Phase 3** — a form with no corpus hit gets a generated sentence containing
  the exact form; a deliberately mismatched echo is discarded
- **Phase 4** — a bulk run survives backgrounding the app and resumes
- **Phase 5** — a round trip: export from the phone, curate on the Mac, import
  back, and confirm the vocabulary and review history are intact afterwards.
  That last check is the one that matters, because import replaces rather than
  merges — a curated file missing `cards` would silently wipe the vocabulary.

---

## 14. Open decisions

1. **Do paradigm questions count as "real" questions in the UI count?** They are
   valid but easier; showing 4,477 available may overstate the quiz's richness.
2. **Should a rejected question be retried automatically?** It spends quota on a
   tap that reads as "delete".
3. **Does Tier 1 need an English translation?** The declension quiz shows one.
   Tatoeba results without an English pair could still serve conjugation, which
   is fill-in-the-blank.
4. **Widen adjectives past nominative singular?** Cheap now that questions are
   demand-driven, but multiplies the form count.
5. **What happens to the 47 `unknown`-type cards?** They have no paradigm and get
   nothing from any tier.
6. **Bundle `nspell` + `dictionary-pl` (§7)?** About 5 MB, offline, spelling
   only. It roughly doubles the APK, and it is the only validation a user who
   never runs the desktop tool would ever get — which is almost all of them.
7. **Does the curation tool stay private, or ship?** It assumes a Mac, Homebrew
   and a JDK. As a personal tool that is fine; as something a user is expected to
   run, it is not.

---

## 15. Risks

- **Tatoeba load — largely resolved.** Moving to the offline export means one
  ~2.3 MB download instead of thousands of requests. Attribution (CC BY 2.0 FR)
  becomes the outstanding obligation.
- **A stale snapshot.** Exports refresh weekly; a snapshot from months ago simply
  covers slightly less. Worth a re-download prompt, not worth engineering around.
- **Corpus sentences are uncontrolled text.** They may be idiomatic, archaic or
  odd. Human-written is not the same as pedagogically ideal.
- **Homographs pass every local check.** A form that is also a different word in
  another part of speech will match on string and produce a sentence that does
  not demonstrate the grammar being asked about. Observed, not hypothetical —
  see §7. Only part-of-speech tagging would catch it.
- **Grammar validation is now optional and off-device.** Most users will never
  run the curation tool, so in practice their questions get Layer 1 only. That is
  a deliberate trade — §7 says what it does and does not catch — but it means the
  shipped quality bar is the deterministic checks, not LanguageTool.
- **The curation round trip is manual.** Export, transfer, curate, transfer back,
  import. It is far shorter than today's process but it is still a round trip,
  and it is the part most likely to go unused.
- **Still no tests.** A generation bug that stores malformed questions would be
  silent, and this feature writes far more data than anything before it. The
  scheduler, storage and quiz-selection logic remain untested.
