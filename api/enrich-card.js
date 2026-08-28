import { SCHEMAS, PROMPTS } from '../shared/llmTasks.js'
import { applyCors } from './_cors.js'
import { llmConfig, generateJson, LlmError, statusFor } from './_llm.js'

// ─── Schemas ──────────────────────────────────────────────────────────────────


// Every card type also returns a few alternative English senses ("secondary
// definitions"), shown under the primary translation in the modal.
for (const s of Object.values(SCHEMAS)) {
  s.properties.definitions = { type: 'array', items: { type: 'string' } }
  s.required = [...s.required, 'definitions']
}

// ─── Prompts ──────────────────────────────────────────────────────────────────


// Appended to every prompt: a few alternative English senses of the word.

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(type, parsed) {
  const arrays6 = (obj) => ['present', 'past', 'past2'].every(k => Array.isArray(obj?.[k]) && obj[k].length === 6 && obj[k].every(s => typeof s === 'string'))
  const arrays7 = (obj, keys) => keys.every(k => Array.isArray(obj?.[k]) && obj[k].length === 7 && obj[k].every(s => typeof s === 'string'))

  if (type === 'verb') {
    return arrays6(parsed.conjugations) &&
      typeof parsed.otherForm?.label === 'string' &&
      typeof parsed.otherForm?.word === 'string'
  }
  if (type === 'noun') {
    return arrays7(parsed.declensions, ['cases', 'singular', 'plural']) &&
      typeof parsed.plAlt === 'string'
  }
  if (type === 'adjective') {
    return arrays7(parsed.declensions, ['cases', 'masculine', 'feminine', 'neuter', 'pluralMasc', 'pluralNonMasc']) &&
      typeof parsed.comparative === 'string' &&
      typeof parsed.superlative === 'string'
  }
  if (type === 'unknown') {
    return typeof parsed.info === 'string'
  }
  return false
}

// ─── Gemini fetch with exponential backoff on 429 ─────────────────────────────


// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { lemma, type } = req.body ?? {}
  if (!lemma || typeof lemma !== 'string' || !lemma.trim()) {
    return res.status(400).json({ error: 'lemma is required' })
  }
  if (!['verb', 'noun', 'adjective', 'unknown'].includes(type)) {
    return res.status(400).json({ error: 'type must be verb, noun, adjective, or unknown' })
  }

  let parsed
  try {
    parsed = await generateJson(llmConfig(req), { system: PROMPTS[type], input: lemma.trim(), schema: SCHEMAS[type] })
  } catch (e) {
    if (!(e instanceof LlmError)) {
      console.error('Enrich failed', e)
      return res.status(500).json({ error: 'Internal server error' })
    }
    if (e.code === 'rate_limited') return res.status(429).json({ error: 'Rate limit — try again shortly' })
    if (e.code === 'not_configured') return res.status(500).json({ error: 'Enrichment service not configured' })
    console.error('Enrich LLM error', e.code, e.message)
    return res.status(statusFor(e.code)).json({ error: 'Enrichment service error' })
  }

  if (!validate(type, parsed)) {
    console.error('Validation failed for type', type, parsed)
    return res.status(502).json({ error: 'Invalid response shape from model' })
  }

  if (type === 'verb') {
    const label = (parsed.otherForm?.label ?? '').toLowerCase()
    const aspect = (label.startsWith('pf') && !label.startsWith('impf')) ? 'impf'
                 : label.startsWith('impf') ? 'pf'
                 : ''
    return res.status(200).json({ ...parsed, aspect })
  }
  return res.status(200).json(parsed)
}
