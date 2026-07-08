# Sentence Mining Feature — Spec

## Goal

Extend the translation page so that when a user translates a Polish (or English) sentence,
the app also analyses the sentence and presents individual lemmatized words as tappable
card candidates. The user can save any word as a new card with the original sentence
automatically attached as source context — true sentence mining built into the capture flow.

This directly addresses the biggest gap in the vocabulary capture workflow: words currently
get saved without the sentence context they were found in, making them weaker learning
artifacts than words mined from real content with their surrounding sentence preserved.

---

## User flow

1. User types or pastes a Polish sentence into the translate page input
2. User taps "Translate"
3. App calls DeepL (existing `/api/translate`) → shows full sentence translation
4. App simultaneously calls new `/api/analyze-sentence` → shows word list below translation
5. Each word in the list shows: lemma, English meaning, word type badge, and either:
   - "+ Add card" button if the word is NOT already in localStorage vocab
   - "✓ Already saved" badge (non-tappable) if the word IS already saved
6. User taps "+ Add card" on any word they want to save
7. Card is created with the original sentence stored as `sourceContext`
8. Button changes to "✓ Already saved" immediately after adding (optimistic UI update)

Both the DeepL call and the Gemini analysis call fire in parallel (Promise.all) —
total latency is the slower of the two, not the sum.

---

## New serverless function: `/api/analyze-sentence`

### Request
```json
POST /api/analyze-sentence
{
  "sentence": "Ten kolorowy ptak siedzi na gałęzi i głośno śpiewa.",
  "sourceLang": "pl"
}
```

### Gemini prompt (structured output)
```
You are a Polish language teacher helping a student mine vocabulary from a sentence.

Analyse this Polish sentence: "[sentence]"

Return ONLY the main content words worth learning as vocabulary — specifically:
- Nouns (rzeczowniki)
- Verbs (czasowniki) — return the infinitive form
- Adjectives (przymiotniki) — return the masculine nominative singular form
- Adverbs (przysłówki) — only if they are genuinely important for meaning

Do NOT include:
- Prepositions (przyimki): w, na, do, z, przez, dla, o, po, przy, między, nad, etc.
- Conjunctions (spójniki): i, a, ale, lub, czy, że, bo, więc, jednak, etc.
- Pronouns (zaimki): ten, ta, to, który, który, mój, twój, etc.
- Particles and interjections: nie, też, już, jeszcze, tylko, właśnie, etc.
- Articles or very high-frequency words a student at B1 level would certainly know

Return a JSON array. Each item must have exactly these fields:
{
  "lemma": "ptak",           // dictionary form
  "type": "noun",            // "noun" | "verb" | "adjective" | "adverb" | "unknown"
  "english": "bird",         // concise English meaning in this sentence's context
  "gender": "m."             // only for nouns: "m." | "f." | "n." — empty string otherwise
}

Return ONLY the JSON array. No preamble, no explanation, no markdown.
```

### Response
```json
{
  "words": [
    { "lemma": "ptak",      "type": "noun",      "english": "bird",      "gender": "m." },
    { "lemma": "kolorowy",  "type": "adjective", "english": "colorful",  "gender": "" },
    { "lemma": "siedzieć",  "type": "verb",       "english": "to sit",    "gender": "" },
    { "lemma": "gałąź",    "type": "noun",       "english": "branch",    "gender": "f." },
    { "lemma": "śpiewać",   "type": "verb",       "english": "to sing",   "gender": "" }
  ]
}
```

### Server-side logic
1. Read `GEMINI_API_KEY` from environment
2. Call Gemini with the prompt above using structured output (response_schema matching
   the array shape) — same pattern as `/api/lemmatize`
3. Parse and validate the response array — if validation fails, return `{ words: [] }`
   with a 200 status rather than an error (graceful degradation: translation still works,
   word list just doesn't appear)
4. Return `{ words: [...] }`

---

## Client-side: "already saved" check

This check happens entirely client-side — no API call needed. Before rendering the word list,
the component reads existing cards from localStorage and builds a Set of known lemmas:

```typescript
const savedLemmas = new Set(
  getSavedCards().map(card => card.pl.toLowerCase())
)

// Then for each word:
const isAlreadySaved = savedLemmas.has(word.lemma.toLowerCase())
```

Show "+ Add card" if not saved, "✓ In vocabulary" if already saved.
Update the Set immediately when the user adds a card (optimistic update) so the button
changes to "✓ In vocabulary" without requiring a page refresh or re-fetch.

---

## Source context field

When a card is created from this flow, attach the original sentence as `sourceContext`:

```typescript
// Extend VocabEntry base interface in src/data/types.ts:
sourceContext?: {
  sentence: string      // the original Polish sentence
  translation: string   // the DeepL translation of the full sentence
  addedFrom: 'sentence-mining' | 'manual' | 'import'
}
```

This field is optional and backwards-compatible — existing cards without it are unaffected.

Future use: the card detail modal can show "Found in: [sentence]" when `sourceContext`
exists, giving the learner the original encounter context. The quiz sentence pipeline
could also prefer `sourceContext.sentence` over AI-generated sentences for cards that
have one.

---

## Translate page UI changes

### Current layout (unchanged)
- Language direction toggle (PL↔EN)
- Text input
- Translate button
- Translation result

### New layout (additions only — don't change existing elements)

Below the translation result, add a new section that appears only when `words.length > 0`:

```
─── Words in this sentence ───────────────────────
[Noun]  ptak · bird                    [+ Add card]
[Verb]  siedzieć · to sit              [+ Add card]
[Adj]   kolorowy · colorful         [✓ In vocabulary]
[Noun]  gałąź · branch                [+ Add card]
[Verb]  śpiewać · to sing             [+ Add card]
──────────────────────────────────────────────────
```

Each row:
- Word type badge (colour-coded, matching existing tag colours: noun=orange, verb=blue,
  adjective=green, adverb/unknown=purple)
- Lemma in Polish (bold)
- · separator
- English meaning
- Right-aligned: "+ Add card" button OR "✓ In vocabulary" grey badge

Loading state: show a subtle skeleton/spinner in the word list area while the Gemini
call is in flight (it fires in parallel with DeepL so latency is minimal, but the
Gemini call may take slightly longer)

Error state: if `/api/analyze-sentence` fails or returns empty, silently hide the word
list section entirely — the translation result is the primary feature and must never
be broken by word analysis failing

---

## Card creation from this flow

When "+ Add card" is tapped:
1. Create a new VocabEntry with:
   - `pl`: the lemma
   - `en`: the English meaning from the analysis
   - `type`: the word type from the analysis
   - `gender`: from the analysis (nouns only)
   - `enriched`: false (enrichment happens on first modal open, as per existing flow)
   - `sourceContext`: { sentence: originalPolishSentence, translation: deeplTranslation,
     addedFrom: 'sentence-mining' }
   - `tags`: [wordType]
2. Save to localStorage via existing `saveCard()` function
3. Update the local `savedLemmas` Set immediately (optimistic update)
4. Show a brief success toast: "ptak added to vocabulary"
5. Trigger card enrichment (the existing deferred enrichment on first modal open handles
   conjugations/declensions — no change needed here)

DO NOT automatically trigger enrichment at save time — keep the existing "enrich on
first modal open" pattern to keep card creation fast.

---

## English→Polish direction

When the user translates FROM English TO Polish, the flow changes slightly:
- DeepL returns the Polish translation of the English input
- The sentence to analyse is the Polish OUTPUT (not the English input)
- Pass the Polish output sentence to `/api/analyze-sentence` with `sourceLang: "pl"`
- Everything else is identical

The UI should make this clear: label the word list "Words in the Polish translation"
rather than "Words in this sentence" when direction is EN→PL.

---

## Build order (for Claude Code)

1. Add `sourceContext` field to `VocabEntry` base interface in `src/data/types.ts`
   (optional field, backwards-compatible, no migration needed)
2. Build `/api/analyze-sentence` Vercel function in isolation — test with a curl call
   against a real Polish sentence before touching any frontend:
   ```bash
   curl -s http://localhost:3001/api/analyze-sentence \
     -X POST -H "Content-Type: application/json" \
     -d '{"sentence":"Ten kolorowy ptak siedzi na gałęzi.","sourceLang":"pl"}'
   ```
   Verify the returned words are correct lemmas with accurate types and meanings
3. Update the translate page to fire both DeepL and Gemini calls in parallel using
   Promise.all — show me the updated fetch logic before writing it
4. Build the word list UI component (below translation result)
5. Wire the "already saved" check using client-side localStorage read
6. Wire the "+ Add card" button with optimistic UI update and success toast
7. Handle EN→PL direction correctly (analyse the Polish output, not the English input)

---

## Out of scope for this pass

- Automatic enrichment at card creation time (keep deferred to first modal open)
- Displaying sourceContext in the card detail modal (natural follow-up, not now)
- Preferring sourceContext sentences over AI-generated ones in the quiz pipeline (future)
- Saving the full sentence itself as a separate "sentence card" format
- Batch mining (analysing multiple sentences at once)
