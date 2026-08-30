# Quiz Sentence Generation Workflow — Spec

## Goal

A local, offline pipeline that:
1. Reads your exported card list (polon-backup-YYYY-MM-DD.json)
2. Generates grammatically correct Polish example sentences for each word/form
3. Validates each sentence through a local LanguageTool instance
4. Produces a reviewed, curated sentences.json file
5. Gets imported into the mobile app alongside your vocabulary

This runs on your Mac periodically (whenever you have new cards to enrich), not in production.
Nothing about this pipeline requires Vercel or any cloud infrastructure beyond the Gemini API
call for generation.

---

## Pipeline overview

```
polon-backup.json
       ↓
  [1] Parse cards
       ↓
  [2] Gemini API → generate 3 candidate sentences per target form
       ↓
  [3] Local LanguageTool → validate each candidate
       ↓
  [4] Keep only zero-error sentences
       ↓
  [5] sentences.json (pending review)
       ↓
  [6] You review in a simple HTML preview tool
       ↓
  [7] sentences-approved.json → imported into the app
```

---

## Step 1 — Input format

Your existing export format (already implemented in the app):
```json
{
  "version": 1,
  "cards": [...],   // VocabEntry[]
  "reviews": {...}  // Record<string, ReviewState>
}
```

The script reads `cards` only. Each card already has:
- `pl` — the lemma (dictionary form)
- `type` — noun / verb / adjective / unknown
- `en` — English translation
- `conjugations` / `declensions` — the full tables from enrichment

---

## Step 2 — What sentences to generate

### For nouns (declension quiz)
Generate one sentence per grammatical case where the noun appears in that case form.
7 cases × 2 numbers (singular + plural) = up to 14 forms per noun.
For v1, prioritise the 4 most common cases: nominative, genitive, accusative, instrumental.
That's 8 sentences per noun (4 cases × singular + plural).

### For verbs (conjugation quiz)
Generate one sentence per conjugated form.
Present tense: 6 forms (ja/ty/on/my/wy/oni). Past tense: 6 forms.
For v1, prioritise present tense only: 6 sentences per verb.

### For adjectives
Generate one sentence per gender form (masculine/feminine/neuter) in nominative singular.
3 sentences per adjective for v1.

### For unknown
Skip — not enough grammatical structure to generate meaningful quiz sentences.

### Target count
With even a small card list (10-15 words), this generates well over 50 sentences.
50 sentence target is easily achievable with 5-7 words.

---

## Step 3 — Gemini generation prompt (per sentence)

Generate 3 candidates per form, keep the best-validated one.
Using structured output (response_schema) to get consistent results.

**Example prompt for noun genitive singular:**
```
You are a Polish language teacher creating example sentences for grammar exercises.

Generate a natural, simple Polish sentence (8-12 words) that:
- Uses the word "[form]" (genitive singular of "[lemma]", meaning "[en]")
- The genitive case must be grammatically required by the sentence structure
  (not just optional or stylistic)
- Uses common, everyday vocabulary — no complex or literary language
- Is factually correct and makes semantic sense
- Does NOT use the word in a title, quotation, or list

Return ONLY a JSON object with this exact shape:
{
  "polish": "the Polish sentence",
  "english": "natural English translation",
  "targetForm": "[form]",
  "targetCase": "genitive",
  "targetNumber": "singular"
}
```

Key prompt engineering decisions:
- Ask for 3 candidates in one call using an array schema, not 3 separate calls
- Specify "grammatically required" case usage — prevents sentences where the case
  is optional or where a different case would also work (which would make a bad quiz)
- Length constraint (8-12 words) keeps sentences readable on a mobile card
- "No titles/quotations/lists" prevents the common LLM shortcut of using genitive
  in a list context ("I have: a cat, a dog, a book") which teaches nothing

---

## Step 4 — LanguageTool validation

### Setup (one-time, on your Mac)

Prerequisites: Docker Desktop installed and running.

```bash
# Pull and start LanguageTool locally
docker run -d \
  --name languagetool \
  -p 8010:8010 \
  -e Java_Xms=512m \
  -e Java_Xmx=1g \
  erikvl87/languagetool

# Verify it's running
curl -s "http://localhost:8010/v2/check" \
  -d "language=pl&text=To jest test." | jq .matches
```

The container is ~500MB and uses ~1GB RAM while running. Start it before running the
generation script, stop it after. You don't need it running at any other time.

### Validation call (per sentence)
```bash
curl -s "http://localhost:8010/v2/check" \
  -d "language=pl" \
  --data-urlencode "text=SENTENCE_HERE"
```

Response: JSON with a `matches` array. Zero matches = no errors detected = sentence passes.
One or more matches = grammar/style issue flagged = sentence rejected.

### Acceptance criteria
- Zero LanguageTool matches (errors) → PASS, include in output
- Any matches → FAIL, try next candidate
- If all 3 candidates fail → mark word/form as "no valid sentence found", skip silently
  and log for manual review

---

## Step 5 — Output format: sentences.json

```json
{
  "generated": "2026-07-01T12:00:00Z",
  "sourceFile": "polon-backup-2026-07-01.json",
  "sentences": [
    {
      "id": "uuid-or-hash",
      "cardLemma": "kot",
      "cardType": "noun",
      "targetForm": "kotów",
      "targetCase": "genitive",
      "targetNumber": "plural",
      "polish": "W ogrodzie nie ma kotów.",
      "english": "There are no cats in the garden.",
      "languageToolPassed": true,
      "approved": false   ← you set this to true in the review step
    },
    ...
  ]
}
```

`approved: false` by default — nothing enters the app until you explicitly approve it.

---

## Step 6 — Review tool

A minimal single-file HTML page (no framework, no build step) that:
- Reads sentences.json via a file input
- Shows each sentence one at a time:
  - Polish sentence with the target form highlighted
  - English translation
  - Grammatical label (e.g. "genitive plural of 'kot'")
  - Two buttons: ✓ Approve / ✗ Reject
- Exports an approved-only sentences.json when done

This lives in /tools/review.html in your project repo.
Open it locally in a browser — no server needed (file:// protocol works fine for this).
You don't need to understand deep Polish grammar to review these:
- Does the highlighted word appear in the sentence? (basic check)
- Does the English translation make sense?
- Does the sentence feel natural? (even as a learner, obviously wrong sentences
  usually feel off)

LanguageTool already caught the structural/grammatical errors —
your review is a common-sense plausibility check, not a grammar exam.

---

## Step 7 — Import into the app

Two options, simplest first:

**Option A — Merge into the existing backup JSON**
Add a `sentences` array to your polon-backup.json before importing it back into the app.
The app's existing Import JSON flow already handles the file — you'd just extend the
import logic to also read and store `sentences` in localStorage (`polon_sentences` key).

**Option B — Separate import**
Add a dedicated "Import Sentences" button in the app's Settings/API Config page,
separate from the card import. Reads a standalone sentences.json file.
Cleaner separation but slightly more frontend work.

Recommend Option A for v1 — minimal new code needed.

---

## The generation script itself

A Node.js script (runs with `node scripts/generate-sentences.js`), not a Python script,
because your project is already Node-based (Vite, Vercel functions) — no new runtime needed.

```
scripts/
  generate-sentences.js   ← main script
tools/
  review.html             ← local review UI
```

### Script arguments
```bash
node scripts/generate-sentences.js \
  --input polon-backup-2026-07-01.json \
  --output sentences.json \
  --languagetool http://localhost:8010 \
  --limit 50              # optional: stop after N validated sentences
```

### Script flow
1. Read and parse input JSON
2. For each card, build a list of target forms to generate sentences for
   (based on existing conjugation/declension tables in the card)
3. For each target form, call Gemini to get 3 candidates
4. For each candidate, call local LanguageTool to validate
5. Keep first candidate that passes, skip the rest
6. Write sentences.json incrementally (don't lose progress if script is interrupted)
7. Print a summary: X sentences generated, Y forms skipped (no valid sentence found)

### Rate limiting
- Add a small delay (500ms) between Gemini calls to avoid hitting rate limits
- LanguageTool is local so no rate limiting needed there
- At 500ms delay, generating 50 sentences takes ~25 seconds — acceptable

---

## Build order (for Claude Code)

1. Set up LanguageTool Docker container and verify it responds to Polish text
2. Write and test the validation function in isolation
   (curl a known-correct and known-wrong Polish sentence, confirm pass/fail)
3. Write and test the Gemini generation function for one word/form
   (verify the structured output schema produces the right JSON shape)
4. Wire them together into the full script with file I/O
5. Run against a real export with 3-5 cards, check output
6. Build review.html
7. Extend the app's import logic to handle sentences

---

## Out of scope for this pass

- Automatic re-generation of rejected sentences (manual re-run of the script is fine)
- Sentence difficulty scoring
- Cloze deletion format (fill-in-the-blank) — the quiz UI design is a separate spec
- In-app sentence generation (always offline/batch for quality control reasons)
