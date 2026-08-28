import { llmConfig, generateJson, LlmError, statusFor } from './_llm.js'

const SCHEMA = {
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

const SYSTEM = `You are a Polish language teacher helping a student mine vocabulary from a sentence.

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



export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { sentence, sourceLang = 'pl' } = req.body ?? {}
  if (!sentence || typeof sentence !== 'string' || !sentence.trim()) {
    return res.status(400).json({ error: 'sentence is required' })
  }

  // This endpoint degrades to an empty word list rather than an error — the
  // sentence breakdown is supplementary, and a failure here shouldn't fail the
  // translation the user actually asked for.
  let parsed
  try {
    parsed = await generateJson(llmConfig(req), {
      system: SYSTEM,
      input: `Analyse this ${sourceLang === 'pl' ? 'Polish' : 'Polish'} sentence: "${sentence.trim()}"`,
      schema: SCHEMA,
    })
  } catch (e) {
    console.error('Analyse-sentence failed', e instanceof LlmError ? `${e.code} ${e.message}` : e)
    return res.status(200).json({ words: [] })
  }

  const words = parsed?.words
  if (!Array.isArray(words)) return res.status(200).json({ words: [] })

  const VALID_TYPES = new Set(['noun', 'verb', 'adjective', 'adverb', 'unknown'])
  const validated = words.filter(w =>
    typeof w.lemma === 'string' && w.lemma.trim() &&
    typeof w.english === 'string' &&
    VALID_TYPES.has(w.type)
  ).map(w => ({
    lemma:   w.lemma.trim(),
    type:    w.type,
    english: w.english.trim(),
    gender:  typeof w.gender === 'string' ? w.gender : '',
  }))

  return res.status(200).json({ words: validated })
}
