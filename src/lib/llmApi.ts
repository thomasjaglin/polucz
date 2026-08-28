// One entry point for every call that used to go to api/*.
//
// On Android with keys configured, the work happens here — the provider is
// called directly and no deployment of ours is involved. Everywhere else the
// request goes to api/* exactly as before.
//
// Each direct branch returns a synthesized Response with the same body and
// status the endpoint would have produced, so callers keep their existing
// res.ok / res.json() / 429 handling and don't need to know which path ran.

import { Capacitor } from '@capacitor/core'
import { apiUrl } from './apiBase'
import { getDeepLKey, getLlmConfig, llmHeaders } from './llmConfig'
import { generateJson, LlmError } from './llmClient'
import {
  LEMMATIZE_SCHEMA, LEMMATIZE_SYSTEM,
  ANALYZE_SCHEMA, ANALYZE_SYSTEM,
  GEN_SCHEMA, GEN_PROMPT,
  SCHEMAS, PROMPTS,
} from '../../shared/llmTasks.js'

type Json = Record<string, any>

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const WANT = 3
const MAX_LEN = 160

// Ported from api/examples.js — attested sentences are preferred over generated
// ones, so the corpus is still tried first on the direct path.
async function fetchTatoeba(word: string): Promise<{ pl: string; en: string }[]> {
  const url = `https://tatoeba.org/en/api_v0/search?query=${encodeURIComponent(word)}&from=pol&to=eng&sort=relevance`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 4000)
  let data: Json
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' }, signal: ctrl.signal })
    if (!r.ok) return []
    data = await r.json()
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
  const out: { pl: string; en: string }[] = []
  for (const result of data.results ?? []) {
    const pl = (result.text ?? '').trim()
    if (!pl || pl.length > MAX_LEN) continue
    const en = (result.translations ?? []).flat()
      .find((t: Json) => t?.lang === 'eng' && t.text)?.text?.trim()
    if (!en) continue
    out.push({ pl, en })
    if (out.length >= 12) break
  }
  return out
}

function excludeClause(exclude: string[]) {
  if (!exclude.length) return ''
  return '\n\nDo NOT reuse or closely paraphrase any of these sentences:\n' +
    exclude.map(s => '- ' + s).join('\n')
}

async function direct(path: string, body: Json): Promise<Response> {
  const cfg = getLlmConfig()

  if (path === '/api/translate') {
    const key = getDeepLKey()
    if (!key) throw new LlmError('upstream', 'no DeepL key')
    // A free-tier key is suffixed :fx and lives on a different host.
    const base = key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com'
    const enPl = body.direction === 'en-pl'
    const r = await fetch(`${base}/v2/translate`, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: [body.text],
        source_lang: enPl ? 'EN' : 'PL',
        target_lang: enPl ? 'PL' : 'EN-US',
      }),
    })
    if (!r.ok) return json({ error: 'Translation service error' }, 502)
    const data = await r.json()
    return json({ translation: data.translations?.[0]?.text ?? '' })
  }

  if (!cfg) throw new LlmError('upstream', 'no LLM key')

  if (path === '/api/lemmatize') {
    const p = await generateJson(cfg, { system: LEMMATIZE_SYSTEM, input: String(body.text).trim(), schema: LEMMATIZE_SCHEMA })
    if (typeof p.lemma !== 'string' || !p.lemma.trim() ||
        !['noun', 'verb', 'adjective', 'unknown'].includes(p.type as string)) {
      return json({ error: 'Invalid response shape from model' }, 502)
    }
    return json({ lemma: (p.lemma as string).trim(), type: p.type, gender: p.gender ?? null, canonicalEn: p.canonicalEn ?? '' })
  }

  if (path === '/api/analyze-sentence') {
    let p: Json
    try {
      p = await generateJson(cfg, {
        system: ANALYZE_SYSTEM,
        input: `Analyse this Polish sentence: "${String(body.sentence).trim()}"`,
        schema: ANALYZE_SCHEMA,
      })
    } catch {
      // Supplementary to the translation — degrade rather than fail the screen.
      return json({ words: [] })
    }
    const words = p.words
    if (!Array.isArray(words)) return json({ words: [] })
    const VALID = new Set(['noun', 'verb', 'adjective', 'adverb', 'unknown'])
    return json({
      words: words.filter((w: Json) =>
        typeof w.lemma === 'string' && w.lemma.trim() && typeof w.english === 'string' && VALID.has(w.type),
      ).map((w: Json) => ({
        lemma: w.lemma.trim(), type: w.type, english: w.english.trim(),
        gender: typeof w.gender === 'string' ? w.gender : '',
      })),
    })
  }

  if (path === '/api/enrich-card') {
    const type = body.type as keyof typeof PROMPTS
    const p = await generateJson(cfg, { system: PROMPTS[type], input: String(body.lemma).trim(), schema: SCHEMAS[type] })
    if (type === 'verb') {
      const label = ((p.otherForm as Json)?.label ?? '').toLowerCase()
      const aspect = (label.startsWith('pf') && !label.startsWith('impf')) ? 'impf'
                   : label.startsWith('impf') ? 'pf' : ''
      return json({ ...p, aspect })
    }
    return json(p)
  }

  if (path === '/api/examples') {
    const w = String(body.word).trim()
    const excludeList: string[] = Array.isArray(body.exclude) ? body.exclude.filter((s: unknown) => typeof s === 'string' && (s as string).trim()) : []
    const excludeSet = new Set(excludeList.map(s => s.trim().toLowerCase()))
    const fresh = (arr: { pl: string; en: string }[]) =>
      arr.filter(e => !excludeSet.has(e.pl.trim().toLowerCase())).slice(0, WANT)

    const corpus = fresh(await fetchTatoeba(w))
    if (corpus.length) return json({ examples: corpus, source: 'corpus' })

    try {
      const p = await generateJson(cfg, { system: GEN_PROMPT, input: w + excludeClause(excludeList), schema: GEN_SCHEMA })
      const gen = Array.isArray(p.examples)
        ? fresh(p.examples
            .filter((e: Json) => e && typeof e.pl === 'string' && typeof e.en === 'string' && e.pl.trim() && e.en.trim())
            .map((e: Json) => ({ pl: e.pl.trim(), en: e.en.trim() })))
        : []
      if (gen.length) return json({ examples: gen, source: 'generated' })
    } catch { /* fall through to the no-examples answer */ }

    return json({ error: 'No examples available' }, 502)
  }

  throw new LlmError('upstream', `no direct path for ${path}`)
}

/** Drop-in for fetch() against api/*. Same Response contract on both paths. */
export async function llmFetch(path: string, body: Json): Promise<Response> {
  const usesDeepL = path === '/api/translate'
  const configured = usesDeepL ? !!getDeepLKey() : !!getLlmConfig()

  // Native with a key goes direct; everything else keeps the server hop, which
  // is what the browser build needs (provider CORS blocks it from a web page).
  if (Capacitor.isNativePlatform() && configured) {
    try {
      return await direct(path, body)
    } catch (e) {
      const code = e instanceof LlmError ? e.code : 'upstream'
      console.error('Direct LLM call failed', path, code, (e as Error)?.message)
      return json({ error: code }, code === 'rate_limited' ? 429 : 502)
    }
  }

  return fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...llmHeaders() },
    body: JSON.stringify(body),
  })
}
