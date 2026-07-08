const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions'

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

async function fetchWithBackoff(apiKey, body) {
  let res
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 1000))
    res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.status !== 429) break
  }
  return res
}

function extractText(data) {
  const step = data.steps?.find(s => s.type === 'model_output')
  return step?.content?.find(c => c.type === 'text')?.text ?? null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { sentence, sourceLang = 'pl' } = req.body ?? {}
  if (!sentence || typeof sentence !== 'string' || !sentence.trim()) {
    return res.status(400).json({ error: 'sentence is required' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Analysis service not configured' })

  let r
  try {
    r = await fetchWithBackoff(apiKey, {
      model: 'gemini-3.5-flash',
      system_instruction: SYSTEM,
      input: `Analyse this ${sourceLang === 'pl' ? 'Polish' : 'Polish'} sentence: "${sentence.trim()}"`,
      response_format: { type: 'text', mime_type: 'application/json', schema: SCHEMA },
    })
  } catch {
    return res.status(200).json({ words: [] })
  }

  if (!r.ok) {
    console.error('Gemini API error', r.status, await r.text().catch(() => ''))
    return res.status(200).json({ words: [] })
  }

  const data = await r.json()
  const raw = extractText(data)
  if (!raw) return res.status(200).json({ words: [] })

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.error('Failed to parse model response:', raw)
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
