// Provider-agnostic JSON generation.
//
// Every LLM endpoint in this app makes the same call: a system prompt, one
// string of input, and a JSON schema the answer must conform to. That single
// primitive is all that needs to be provider-aware, so it lives here and each
// endpoint keeps only its own prompt, schema, and validation.
//
// Which provider runs is chosen per request: the client may send its own
// provider/key (see src/lib/llmConfig.ts), and the server falls back to
// GEMINI_API_KEY when it doesn't. That fallback is what keeps the app working
// for anyone who never opens the settings page.
//
// Note tts.js and translate.js do NOT go through here — TTS is Gemini's audio
// generation, which has no cross-provider equivalent, and translate is DeepL,
// which isn't an LLM at all. Both stay on their own server-side keys.

import Anthropic from '@anthropic-ai/sdk'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions'

export const PROVIDERS = ['gemini', 'anthropic', 'openai-compatible']

// Used when the client names a provider but no model. openai-compatible has no
// default: the endpoint is arbitrary, so there is no model we could assume.
export const DEFAULT_MODEL = {
  gemini: 'gemini-3.5-flash',
  anthropic: 'claude-opus-5',
  'openai-compatible': '',
}

// Endpoints map `code` to an HTTP status; `status` carries the upstream one for logs.
export class LlmError extends Error {
  constructor(code, detail = '') {
    super(detail || code)
    this.code = code // not_configured | rate_limited | upstream | empty | malformed | refused
  }
}

export function statusFor(code) {
  if (code === 'rate_limited') return 429
  if (code === 'not_configured') return 500
  return 502
}

// Resolve the provider for one request: the caller's own key if it sent a
// complete config, else the server's. A partial config (provider without key)
// falls through rather than failing — a half-filled settings form shouldn't
// take the app down.
export function llmConfig(req) {
  const h = req.headers ?? {}
  const provider = h['x-llm-provider']
  const apiKey = h['x-llm-key']

  if (apiKey && PROVIDERS.includes(provider)) {
    const model = h['x-llm-model'] || DEFAULT_MODEL[provider]
    const baseUrl = (h['x-llm-base-url'] || '').replace(/\/+$/, '')
    if (model && (provider !== 'openai-compatible' || baseUrl)) {
      return { provider, apiKey, model, baseUrl }
    }
  }

  const envKey = process.env.GEMINI_API_KEY
  if (!envKey) return null
  return { provider: 'gemini', apiKey: envKey, model: DEFAULT_MODEL.gemini, baseUrl: '' }
}

// Both Anthropic and the OpenAI json_schema mode reject objects that don't
// close themselves off, and OpenAI's strict mode additionally requires every
// property to be listed in `required`. The endpoint schemas are written for
// Gemini, which asks for neither, so tighten a copy here rather than making
// each endpoint carry provider-specific spellings of the same shape.
function strictify(schema, requireAll) {
  if (!schema || typeof schema !== 'object') return schema
  if (Array.isArray(schema)) return schema.map(s => strictify(s, requireAll))

  const out = { ...schema }
  if (out.properties && typeof out.properties === 'object') {
    out.properties = Object.fromEntries(
      Object.entries(out.properties).map(([k, v]) => [k, strictify(v, requireAll)]),
    )
    out.additionalProperties = false
    if (requireAll) out.required = Object.keys(out.properties)
  }
  if (out.items) out.items = strictify(out.items, requireAll)
  return out
}

// Exponential backoff on 429 — 3 attempts: immediate, 1s, 2s. Shared by the two
// raw-HTTP adapters; the Anthropic SDK does its own retrying.
async function fetchWithBackoff(url, init) {
  let res
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 2 ** (attempt - 1) * 1000))
    try {
      res = await fetch(url, init)
    } catch (e) {
      // DNS failure, refused connection, a base URL that points nowhere. Left
      // unwrapped this escapes as a bare TypeError and the endpoint reports an
      // internal error for what is plainly an upstream one.
      throw new LlmError('upstream', `network: ${e?.message ?? e}`)
    }
    if (res.status !== 429) break
  }
  return res
}

function parseOrThrow(raw) {
  if (!raw || !raw.trim()) throw new LlmError('empty')
  try {
    return JSON.parse(raw)
  } catch {
    throw new LlmError('malformed', raw.slice(0, 500))
  }
}

// ─── Adapters ───────────────────────────────────────────────────────────────
// Each returns the model's raw JSON text; the caller parses once.

async function gemini(cfg, { system, input, schema }) {
  const res = await fetchWithBackoff(GEMINI_URL, {
    method: 'POST',
    headers: { 'x-goog-api-key': cfg.apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: cfg.model,
      system_instruction: system,
      input,
      response_format: { type: 'text', mime_type: 'application/json', schema },
    }),
  })

  if (res.status === 429) throw new LlmError('rate_limited')
  if (!res.ok) throw new LlmError('upstream', `gemini ${res.status} ${await res.text().catch(() => '')}`)

  const data = await res.json()
  const step = data.steps?.find(s => s.type === 'model_output')
  return step?.content?.find(c => c.type === 'text')?.text ?? null
}

async function anthropic(cfg, { system, input, schema }) {
  const client = new Anthropic({ apiKey: cfg.apiKey })

  let msg
  try {
    msg = await client.messages.create({
      model: cfg.model,
      // Generous: on current models max_tokens caps thinking and response text
      // together, so a limit sized to the answer alone truncates mid-JSON.
      max_tokens: 16000,
      system,
      messages: [{ role: 'user', content: input }],
      output_config: { format: { type: 'json_schema', schema: strictify(schema, false) } },
    })
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new LlmError('rate_limited')
    if (e instanceof Anthropic.APIError) throw new LlmError('upstream', `anthropic ${e.status} ${e.message}`)
    throw new LlmError('upstream', String(e))
  }

  // Safety classifiers can decline with a normal 200 and no content — reading
  // content[0] without this check throws instead of reporting what happened.
  if (msg.stop_reason === 'refusal') throw new LlmError('refused')

  return msg.content.find(b => b.type === 'text')?.text ?? null
}

async function openaiCompatible(cfg, { system, input, schema }) {
  const res = await fetchWithBackoff(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: input },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'result', strict: true, schema: strictify(schema, true) },
      },
    }),
  })

  if (res.status === 429) throw new LlmError('rate_limited')
  if (!res.ok) throw new LlmError('upstream', `openai-compatible ${res.status} ${await res.text().catch(() => '')}`)

  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? null
}

const ADAPTERS = { gemini, anthropic, 'openai-compatible': openaiCompatible }

/** system prompt + input + JSON schema → parsed object. Throws LlmError. */
export async function generateJson(cfg, { system, input, schema }) {
  if (!cfg) throw new LlmError('not_configured')
  const adapter = ADAPTERS[cfg.provider]
  if (!adapter) throw new LlmError('not_configured', `unknown provider ${cfg.provider}`)
  return parseOrThrow(await adapter(cfg, { system, input, schema }))
}
