// Usage examples for a Polish word. Corpus-first (Tatoeba — real, human-written
// sentence pairs), with an LLM fallback (Gemini) when the corpus has no
// coverage. The response tags its `source` so the UI can be honest about
// whether the examples are attested or generated.

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions'
const WANT = 3            // examples to aim for
const MAX_LEN = 160       // skip very long corpus sentences

// ─── Corpus: Tatoeba ────────────────────────────────────────────────────────

async function fetchTatoeba(word) {
  const url = `https://tatoeba.org/en/api_v0/search?query=${encodeURIComponent(word)}&from=pol&to=eng&sort=relevance`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 4000)
  let data
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' }, signal: ctrl.signal })
    if (!r.ok) return []
    data = await r.json()
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }

  const out = []
  for (const result of data.results ?? []) {
    const pl = (result.text ?? '').trim()
    if (!pl || pl.length > MAX_LEN) continue
    // translations is [directTranslations[], indirectTranslations[]]
    const en = (result.translations ?? []).flat().find(t => t?.lang === 'eng' && t.text)?.text?.trim()
    if (!en) continue
    out.push({ pl, en })
    if (out.length >= WANT) break
  }
  return out
}

// ─── Fallback: Gemini ───────────────────────────────────────────────────────

const GEN_SCHEMA = {
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

const GEN_PROMPT =
  'You are a Polish language teacher. Given a single Polish word, write exactly 3 short, ' +
  'natural example sentences in Polish that a native speaker would actually say, each using ' +
  'that word (any inflected form is fine), with a faithful English translation. Prefer common, ' +
  'everyday phrasing over textbook stiffness. Return JSON matching the schema.'

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

async function fetchGenerated(word) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return []
  let r
  try {
    r = await fetchWithBackoff(apiKey, {
      model: 'gemini-3.5-flash',
      system_instruction: GEN_PROMPT,
      input: word,
      response_format: { type: 'text', mime_type: 'application/json', schema: GEN_SCHEMA },
    })
  } catch {
    return []
  }
  if (!r.ok) return []
  const raw = extractText(await r.json())
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed.examples)) return []
    return parsed.examples
      .filter(e => e && typeof e.pl === 'string' && typeof e.en === 'string' && e.pl.trim() && e.en.trim())
      .slice(0, WANT)
      .map(e => ({ pl: e.pl.trim(), en: e.en.trim() }))
  } catch {
    return []
  }
}

// ─── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { word } = req.body ?? {}
  if (!word || typeof word !== 'string' || !word.trim()) {
    return res.status(400).json({ error: 'word is required' })
  }
  const w = word.trim()

  // Corpus first (real attested usage) …
  const corpus = await fetchTatoeba(w)
  if (corpus.length > 0) {
    return res.status(200).json({ examples: corpus, source: 'corpus' })
  }

  // … LLM fallback where the corpus has no coverage.
  const generated = await fetchGenerated(w)
  if (generated.length > 0) {
    return res.status(200).json({ examples: generated, source: 'generated' })
  }

  return res.status(502).json({ error: 'No examples available' })
}
