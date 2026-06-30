# Card Creation & Enrichment — LLM-Based Approach (v1)

## Context

Morfeusz (Polish morphological analyzer, ~98% lemmatization accuracy) was investigated as the
"proper" tool for lemmatization + declension/conjugation generation, but it's not available as a
simple hosted API — it's self-hosted software requiring its own server. Out of scope for now;
revisit later as a quality upgrade. For v1, use an LLM call instead, since it requires no new
infrastructure beyond what's already used for the DeepL proxy.

**Provider: Google Gemini API (free tier)** — chosen specifically over the Claude API for this
feature because Claude Pro/Claude Code subscriptions don't include API credit; the Claude API is
separate pay-as-you-go billing. Gemini's free tier (1,500 req/day, no card required) comfortably
covers personal vocabulary-app usage at zero cost. See API setup section below for important
billing caveats.

---

## Flow (confirmed)

1. **Translate** (existing `/api/translate`): user looks up a word, either PL→EN or EN→PL.
   No card created yet.
2. **User taps "Add to vocabulary"** on the translation result. Card is always Polish-headword
   first, regardless of which direction the lookup happened in.
3. **Lemmatization step** (new): send the Polish word to an LLM, get back the dictionary-form
   lemma + word type (noun/verb/adjective/unknown) + minimal grammatical info needed for dedupe
   and basic display (e.g. gender for nouns).
4. **Dedupe check**: compare the returned lemma against existing saved cards' lemmas. If it
   already exists, surface that to the user (e.g. "Already in your vocabulary" — don't silently
   skip, and don't silently create a duplicate either; let the user decide, e.g. view existing
   card vs. cancel).
5. **Save card** to localStorage with the lemma, translation, word type, minimal grammar info.
   Declensions/conjugations are NOT fetched yet — left empty/null.
6. **First modal open** (deferred enrichment): when this card is opened for the first time,
   trigger a second LLM call to populate the full declension/conjugation table. Cache the result
   into the saved card so this only happens once per card, not on every open.

---

## New serverless function: `/api/enrich-word` (or split into two — see below)

Two distinct LLM calls are needed, and they should probably be separate endpoints/prompts rather
than one combined call, since they happen at different times and have different latency
tolerances:

### `/api/lemmatize` — fast, called at card-creation time
- Input: the Polish word as typed/translated (could be an inflected form)
- Output (structured JSON): `{ lemma: string, type: "noun" | "verb" | "adjective" | "unknown", gender?: string }`
- Needs to be FAST since this is in the critical path of card creation — the user is waiting.
  Keep the prompt minimal, ask only for what's needed at this stage.

### `/api/enrich-card` — slower, called on first modal open, results cached
- Input: the lemma + word type (already known from step above)
- Output (structured JSON), shape depends on type:
  - Verb: `{ conjugations: { present: string[], past: string[], past2: string[] } }`
  - Noun: `{ declensions: { cases: string[], singular: string[], plural: string[] } }`
  - Adjective/Unknown: `{ info?: string }`
- This matches the existing `VocabEntry` type shape already defined in `src/data/types.ts` —
  the LLM output should be validated/parsed to conform to that exact interface.

---

## Reliability requirements (important — this is the main risk with LLM-based grammar generation)

- **Use Gemini's structured output feature** (pass a JSON schema via `response_format`/
  `response_schema` in the request — Claude Code should verify the current exact parameter
  name/format against Google's docs at build time, since this has shifted across Gemini API
  versions). This constrains the model's output to match your schema, removing most malformed-
  response risk. Define the schema for each endpoint's expected shape directly (matching the
  `VocabEntry` types already in `src/data/types.ts`).
- **Important distinction**: structured output guarantees the response's *shape*, not its
  *accuracy*. Gemini can still return a perfectly-formatted but linguistically wrong declension
  table. This is why the "editable, not authoritative" requirement below remains essential
  regardless of using structured output — it solves a different problem (parsing reliability),
  not the one we actually care about most (correctness).
- **Validate the parsed response server-side anyway**, as a safety net for edge cases (e.g.
  truncated responses if output token limits are hit) even though structured output makes
  malformed JSON rare. If validation fails, return a clear error rather than passing through
  garbage.
- **Surface uncertainty to the user, don't hide it.** Since accuracy won't be Morfeusz-level
  (~98%), the card UI should allow the user to manually edit any field after it's
  auto-populated — these fields should never be treated as locked/authoritative. This matters
  given the project's stated priority: "reducing risk of false information as much as possible."
  A visible "edit" affordance on grammar tables is the practical mitigation for v1, since we're
  not yet using a verified linguistic source.
- Consider a small visual indicator (e.g. a subtle badge) on auto-generated-but-unverified fields,
  distinct from fields a user has manually confirmed/edited — this is a nice-to-have, not
  required for v1, but worth flagging as a natural follow-up once the basic flow works.

---

## API setup

- Provider: **Google Gemini API** (free tier — 1,500 requests/day, 1M tokens/minute on Flash
  models, no credit card required, no expiration as of mid-2026). This comfortably covers
  personal vocabulary-app usage; chosen specifically to avoid the pay-as-you-go cost of the
  Claude API for this feature.
- New environment variable: `GEMINI_API_KEY`, set server-side only (same pattern as
  `DEEPL_API_KEY` — Vercel dashboard, never in client code or committed files).
- Get the key from Google AI Studio (aistudio.google.com) — free, no credit card needed to
  generate a key or use the free tier.
- **Critical — do not enable billing on this Google Cloud project.** Unlike most cloud free
  tiers, enabling billing on a Gemini API project removes the free tier entirely rather than
  adding headroom on top of it — every call becomes billable from the first token. If anything
  ever prompts to "add a billing method" for this project, decline, unless deliberately choosing
  to move to paid usage.
- Model: a current Flash model (e.g. `gemini-3-flash-preview` or whatever is current/recommended
  for free-tier structured output at build time — verify against Google's docs rather than
  hardcoding, since model names/availability shift).
- Structured output: pass a JSON schema directly in the request (`response_format` /
  `response_schema`, per Gemini's structured-outputs documentation) — same reliability principle
  as originally planned, just a different API's parameter names. The "guarantees shape, not
  accuracy" caveat applies here too — Gemini can also hallucinate well-formatted but incorrect
  grammar data, so the editable-fields requirement below remains essential.
- Rate limit handling: implement basic exponential backoff on 429 responses (rare at this usage
  scale, but cheap insurance) rather than assuming every call succeeds.

## Out of scope for this pass

- Morfeusz integration (revisit later for accuracy upgrade)
- Confidence scoring / verification UI beyond a basic "edit" button
- Batch enrichment of multiple cards at once
- Any secondary/fallback LLM provider — Gemini only for now
