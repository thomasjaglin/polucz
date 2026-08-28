import { llmConfig, generateJson, LlmError } from './_llm.js'

// Usage examples for a Polish word. Corpus-first (Tatoeba — real, human-written
// sentence pairs), with an LLM fallback (Gemini) when the corpus has no
// coverage. The response tags its `source` so the UI can be honest about
// whether the examples are attested or generated.

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
    // Collect more than WANT so the "different examples" refresh has fresh
    // candidates to fall back on after excluding already-seen sentences.
    if (out.length >= 12) break
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

// Appended to the model input when refreshing, so it doesn't repeat sentences
// the user has already seen.
function excludeClause(exclude) {
  if (!exclude.length) return ''
  return '\n\nDo NOT reuse or closely paraphrase any of these sentences:\n' +
    exclude.map(s => '- ' + s).join('\n')
}



// Returns [] on any failure — this is the fallback path behind the corpus, and
// the handler already has a "no examples available" answer for the empty case.
async function fetchGenerated(req, word, exclude = []) {
  let parsed
  try {
    parsed = await generateJson(llmConfig(req), {
      system: GEN_PROMPT,
      input: word + excludeClause(exclude),
      schema: GEN_SCHEMA,
    })
  } catch (e) {
    console.error('Example generation failed', e instanceof LlmError ? `${e.code} ${e.message}` : e)
    return []
  }
  if (!Array.isArray(parsed.examples)) return []
  return parsed.examples
    .filter(e => e && typeof e.pl === 'string' && typeof e.en === 'string' && e.pl.trim() && e.en.trim())
    .slice(0, WANT)
    .map(e => ({ pl: e.pl.trim(), en: e.en.trim() }))
}

// ─── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { word, exclude } = req.body ?? {}
  if (!word || typeof word !== 'string' || !word.trim()) {
    return res.status(400).json({ error: 'word is required' })
  }
  const w = word.trim()

  // Optional: sentences already shown, so a "different examples" refresh can
  // skip them. Empty on the first fetch → behaves exactly as before.
  const excludeList = Array.isArray(exclude) ? exclude.filter(s => typeof s === 'string' && s.trim()) : []
  const excludeSet = new Set(excludeList.map(s => s.trim().toLowerCase()))
  const fresh = arr => arr.filter(e => !excludeSet.has(e.pl.trim().toLowerCase())).slice(0, WANT)

  // Corpus first (real attested usage) …
  const corpus = fresh(await fetchTatoeba(w))
  if (corpus.length > 0) {
    return res.status(200).json({ examples: corpus, source: 'corpus' })
  }

  // … LLM fallback where the corpus has no coverage (or is exhausted on refresh).
  const generated = fresh(await fetchGenerated(req, w, excludeList))
  if (generated.length > 0) {
    return res.status(200).json({ examples: generated, source: 'generated' })
  }

  return res.status(502).json({ error: 'No examples available' })
}
