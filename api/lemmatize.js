import { llmConfig, generateJson, LlmError, statusFor } from './_llm.js'

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



export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { text } = req.body ?? {}
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' })
  }
  if (text.trim().length > 120) {
    return res.status(400).json({ error: 'text too long — send a single word' })
  }

  let parsed
  try {
    parsed = await generateJson(llmConfig(req), { system: SYSTEM, input: text.trim(), schema: SCHEMA })
  } catch (e) {
    if (!(e instanceof LlmError)) {
      console.error('Lemmatize failed', e)
      return res.status(500).json({ error: 'Internal server error' })
    }
    if (e.code === 'rate_limited') return res.status(429).json({ error: 'Rate limit — try again shortly' })
    if (e.code === 'not_configured') return res.status(500).json({ error: 'Lemmatization service not configured' })
    console.error('Lemmatize LLM error', e.code, e.message)
    return res.status(statusFor(e.code)).json({ error: 'Lemmatization service error' })
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
