const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const VERB_SCHEMA = {
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

const NOUN_SCHEMA = {
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

const ADJECTIVE_SCHEMA = {
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

const UNKNOWN_SCHEMA = {
  type: 'object',
  properties: {
    info: { type: 'string' },
  },
  required: ['info'],
}

const SCHEMAS = { verb: VERB_SCHEMA, noun: NOUN_SCHEMA, adjective: ADJECTIVE_SCHEMA, unknown: UNKNOWN_SCHEMA }

// Every card type also returns a few alternative English senses ("secondary
// definitions"), shown under the primary translation in the modal.
for (const s of Object.values(SCHEMAS)) {
  s.properties.definitions = { type: 'array', items: { type: 'string' } }
  s.required = [...s.required, 'definitions']
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

const PROMPTS = {
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

// Appended to every prompt: a few alternative English senses of the word.
const DEFINITIONS_LINE =
  '\n- definitions: 2-4 short alternative English senses/meanings of the word, most common first (single words or short phrases). Omit near-duplicates.'
for (const k of Object.keys(PROMPTS)) PROMPTS[k] += DEFINITIONS_LINE

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

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { lemma, type } = req.body ?? {}
  if (!lemma || typeof lemma !== 'string' || !lemma.trim()) {
    return res.status(400).json({ error: 'lemma is required' })
  }
  if (!['verb', 'noun', 'adjective', 'unknown'].includes(type)) {
    return res.status(400).json({ error: 'type must be verb, noun, adjective, or unknown' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Enrichment service not configured' })

  let r
  try {
    r = await fetchWithBackoff(apiKey, {
      model: 'gemini-3.5-flash',
      system_instruction: PROMPTS[type],
      input: lemma.trim(),
      response_format: { type: 'text', mime_type: 'application/json', schema: SCHEMAS[type] },
    })
  } catch {
    return res.status(500).json({ error: 'Internal server error' })
  }

  if (r.status === 429) return res.status(429).json({ error: 'Rate limit — try again shortly' })

  if (!r.ok) {
    const errBody = await r.text().catch(() => '')
    console.error('Gemini API error', r.status, errBody)
    return res.status(502).json({ error: 'Enrichment service error' })
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
