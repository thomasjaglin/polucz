import { ANALYZE_SCHEMA as SCHEMA, ANALYZE_SYSTEM as SYSTEM } from '../shared/llmTasks.js'
import { applyCors } from './_cors.js'
import { llmConfig, generateJson, LlmError, statusFor } from './_llm.js'


export default async function handler(req, res) {
  if (applyCors(req, res)) return
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
