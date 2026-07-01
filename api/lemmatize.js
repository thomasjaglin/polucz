const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions'

const SCHEMA = {
  type: 'object',
  properties: {
    lemma:       { type: 'string' },
    type:        { type: 'string', enum: ['noun', 'verb', 'adjective', 'unknown'] },
    gender:      { type: 'string' },
    canonicalEn: { type: 'string' },
  },
  required: ['lemma', 'type', 'gender', 'canonicalEn'],
}

const SYSTEM = `You are a Polish morphological analyzer. Given a single Polish word (possibly inflected), return its canonical dictionary form, grammatical class, and canonical English translation.

lemma: the dictionary form. Verbs → infinitive. Nouns → nominative singular. Adjectives → masculine nominative singular. Unknown → return the word as-is.
type: "verb", "noun", "adjective", or "unknown".
gender: for nouns, one of "m.", "f.", or "n." (with the period). For all other types, return an empty string "".
canonicalEn: the canonical English translation of the lemma (not the inflected input). Verbs → "to [verb]" form (e.g. "to think", "to run"). Nouns → bare singular (e.g. "friend", "house"). Adjectives → base form (e.g. "happy", "big"). Unknown → best-effort short translation.`

// Exponential backoff on 429 — 3 attempts: immediate, 1s, 2s
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

  const { text } = req.body ?? {}
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' })
  }
  if (text.trim().length > 120) {
    return res.status(400).json({ error: 'text too long — send a single word' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Lemmatization service not configured' })

  let r
  try {
    r = await fetchWithBackoff(apiKey, {
      model: 'gemini-3.5-flash',
      system_instruction: SYSTEM,
      input: text.trim(),
      response_format: { type: 'text', mime_type: 'application/json', schema: SCHEMA },
    })
  } catch {
    return res.status(500).json({ error: 'Internal server error' })
  }

  if (r.status === 429) return res.status(429).json({ error: 'Rate limit — try again shortly' })

  if (!r.ok) {
    const errBody = await r.text().catch(() => '')
    console.error('Gemini API error', r.status, errBody)
    return res.status(502).json({ error: 'Lemmatization service error' })
  }

  const data = await r.json()
  const raw = extractText(data)
  if (!raw) return res.status(502).json({ error: 'Empty response from model' })

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.error('Failed to parse model response:', raw)
    return res.status(502).json({ error: 'Malformed response from model' })
  }

  // Safety-net validation — structured output makes this rare but guards against truncation
  const { lemma, type, gender, canonicalEn } = parsed
  if (
    typeof lemma !== 'string' || !lemma.trim() ||
    !['noun', 'verb', 'adjective', 'unknown'].includes(type)
  ) {
    console.error('Invalid response shape:', parsed)
    return res.status(502).json({ error: 'Invalid response shape from model' })
  }

  return res.status(200).json({ lemma: lemma.trim(), type, gender: gender ?? null, canonicalEn: canonicalEn ?? '' })
}
