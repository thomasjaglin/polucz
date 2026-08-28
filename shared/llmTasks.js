// The model-facing contract for every LLM task: the system prompt and the JSON
// schema the answer must satisfy.
//
// Shared because there are two call paths — the browser goes through api/*, and
// the packaged Android app talks to the provider directly (src/lib/llmClient.ts).
// If these drifted apart the same action would quietly produce different results
// on the two, with nothing to point at.
//
// Plain JS with no imports, so both a Vercel function and the Vite bundle can
// read it. Prompts and schemas only — transport and validation stay with their
// own callers.

// ─── lemmatize ─────────────────────────────────────────────────────────
export const LEMMATIZE_SCHEMA = {
  type: 'object',
  properties: {
    lemma:       { type: 'string' },
    type:        { type: 'string', enum: ['noun', 'verb', 'adjective', 'unknown'] },
    gender:      { type: 'string' },
    canonicalEn: { type: 'string' },
  },
  required: ['lemma', 'type', 'gender', 'canonicalEn'],
}
export const LEMMATIZE_SYSTEM = `You are a Polish morphological analyzer. Given a single Polish word (possibly inflected), return its canonical dictionary form, grammatical class, and canonical English translation.

lemma: the dictionary form. Verbs → infinitive. Nouns → nominative singular. Adjectives → masculine nominative singular. Unknown → return the word as-is.
type: "verb", "noun", "adjective", or "unknown".
gender: for nouns, one of "m.", "f.", or "n." (with the period). For all other types, return an empty string "".
canonicalEn: the canonical English translation of the lemma (not the inflected input). Verbs → "to [verb]" form (e.g. "to think", "to run"). Nouns → bare singular (e.g. "friend", "house"). Adjectives → base form (e.g. "happy", "big"). Unknown → best-effort short translation.`

// ─── analyze-sentence ──────────────────────────────────────────────────
export const ANALYZE_SCHEMA = {
  type: 'object',
  properties: {
    words: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          lemma:   { type: 'string' },
          type:    { type: 'string', enum: ['noun', 'verb', 'adjective', 'adverb', 'unknown'] },
          english: { type: 'string' },
          gender:  { type: 'string' },
        },
        required: ['lemma', 'type', 'english', 'gender'],
      },
    },
  },
  required: ['words'],
}
export const ANALYZE_SYSTEM = `You are a Polish language teacher helping a student mine vocabulary from a sentence.

Return ONLY the main content words worth learning as vocabulary — specifically:
- Nouns (rzeczowniki)
- Verbs (czasowniki) — return the infinitive form
- Adjectives (przymiotniki) — return the masculine nominative singular form
- Adverbs (przysłówki) — only if they are genuinely important for meaning

Do NOT include:
- Prepositions (przyimki): w, na, do, z, przez, dla, o, po, przy, między, nad, etc.
- Conjunctions (spójniki): i, a, ale, lub, czy, że, bo, więc, jednak, etc.
- Pronouns (zaimki): ten, ta, to, który, mój, twój, etc.
- Particles and interjections: nie, też, już, jeszcze, tylko, właśnie, etc.
- Articles or very high-frequency words a student at B1 level would certainly know

Return a JSON object with a single key "words" containing an array. Each item must have exactly these fields:
- lemma: dictionary form of the word
- type: "noun" | "verb" | "adjective" | "adverb" | "unknown"
- english: concise English meaning in this sentence's context
- gender: for nouns only — "m." | "f." | "n." — empty string for all other types`

// ─── examples ──────────────────────────────────────────────────────────
export const GEN_SCHEMA = {
  type: 'object',
  properties: {
    examples: {
      type: 'array',
      items: {
        type: 'object',
        properties: { pl: { type: 'string' }, en: { type: 'string' } },
        required: ['pl', 'en'],
      },
    },
  },
  required: ['examples'],
}
export const GEN_PROMPT =
  'You are a Polish language teacher. Given a single Polish word, write exactly 3 short, ' +
  'natural example sentences in Polish that a native speaker would actually say, each using ' +
  'that word (any inflected form is fine), with a faithful English translation. Prefer common, ' +
  'everyday phrasing over textbook stiffness. Return JSON matching the schema.'

// ─── enrich-card ───────────────────────────────────────────────────────
export const VERB_SCHEMA = {
  type: 'object',
  properties: {
    conjugations: {
      type: 'object',
      properties: {
        present: { type: 'array', items: { type: 'string' } },
        past:    { type: 'array', items: { type: 'string' } },
        past2:   { type: 'array', items: { type: 'string' } },
      },
      required: ['present', 'past', 'past2'],
    },
    otherForm: {
      type: 'object',
      properties: {
        label: { type: 'string' },
        word:  { type: 'string' },
      },
      required: ['label', 'word'],
    },
  },
  required: ['conjugations', 'otherForm'],
}
export const NOUN_SCHEMA = {
  type: 'object',
  properties: {
    declensions: {
      type: 'object',
      properties: {
        cases:    { type: 'array', items: { type: 'string' } },
        singular: { type: 'array', items: { type: 'string' } },
        plural:   { type: 'array', items: { type: 'string' } },
      },
      required: ['cases', 'singular', 'plural'],
    },
    plAlt: { type: 'string' },
  },
  required: ['declensions', 'plAlt'],
}
export const ADJECTIVE_SCHEMA = {
  type: 'object',
  properties: {
    declensions: {
      type: 'object',
      properties: {
        cases:        { type: 'array', items: { type: 'string' } },
        masculine:    { type: 'array', items: { type: 'string' } },
        feminine:     { type: 'array', items: { type: 'string' } },
        neuter:       { type: 'array', items: { type: 'string' } },
        pluralMasc:   { type: 'array', items: { type: 'string' } },
        pluralNonMasc:{ type: 'array', items: { type: 'string' } },
      },
      required: ['cases', 'masculine', 'feminine', 'neuter', 'pluralMasc', 'pluralNonMasc'],
    },
    comparative: { type: 'string' },
    superlative: { type: 'string' },
  },
  required: ['declensions', 'comparative', 'superlative'],
}
export const UNKNOWN_SCHEMA = {
  type: 'object',
  properties: {
    info: { type: 'string' },
  },
  required: ['info'],
}
export const SCHEMAS = { verb: VERB_SCHEMA, noun: NOUN_SCHEMA, adjective: ADJECTIVE_SCHEMA, unknown: UNKNOWN_SCHEMA }
export const DEFINITIONS_LINE =
  '\n- definitions: 2-4 short alternative English senses/meanings of the word, most common first (single words or short phrases). Omit near-duplicates.'
export const PROMPTS = {
  verb: `You are a Polish grammar reference. Given a Polish verb infinitive, return:
- conjugations.present: 6 present-tense forms [ja, ty, on/ona/ono, my, wy, oni/one]
- conjugations.past: 6 masculine past forms [ja, ty, on, my, wy, oni]
- conjugations.past2: 6 feminine past forms [ja, ty, ona, my, wy, one]
- otherForm.label: "pf form" if this verb is imperfective, "impf form" if perfective
- otherForm.word: the aspect-pair partner verb`,

  noun: `You are a Polish grammar reference. Given a Polish noun in nominative singular, return:
- declensions.cases: the 7 case names in Polish [mianownik, dopełniacz, celownik, biernik, narzędnik, miejscownik, wołacz]
- declensions.singular: the 7 singular declined forms in that case order
- declensions.plural: the 7 plural declined forms in that case order
- plAlt: the nominative plural form`,

  adjective: `You are a Polish grammar reference. Given a Polish adjective in masculine nominative singular, return:
- declensions.cases: the 7 case names in Polish [mianownik, dopełniacz, celownik, biernik, narzędnik, miejscownik, wołacz]
- declensions.masculine: 7 masculine singular forms
- declensions.feminine: 7 feminine singular forms
- declensions.neuter: 7 neuter singular forms
- declensions.pluralMasc: 7 masculine personal (virile) plural forms
- declensions.pluralNonMasc: 7 non-masculine personal (non-virile) plural forms
- comparative: the comparative form (stopień wyższy) in masculine nominative singular — the synthetic form when it exists (e.g. "większy", "ładniejszy"), otherwise the periphrastic "bardziej <adj>". If the adjective is not gradable (e.g. relational adjectives like "drewniany", "polski", "codzienny"), return an empty string.
- superlative: the superlative form (stopień najwyższy) in masculine nominative singular (e.g. "największy", "najładniejszy", or "najbardziej <adj>"). If the adjective is not gradable, return an empty string.
For the accusative masculine singular, use the slash notation "anim/inanim" where the forms differ.`,

  unknown: `You are a Polish grammar reference. Given an unclassified Polish word, return a brief grammatical note in the info field. If nothing useful can be said, return an empty string.`,
}

// Every card type gets the same definitions clause appended.
for (const k of Object.keys(PROMPTS)) PROMPTS[k] += DEFINITIONS_LINE

