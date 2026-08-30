// Provider adapters for the packaged app.
//
// The Android build talks to the LLM provider directly rather than through
// api/*, so it needs no deployment of ours to work — the user's key is the only
// key. CapacitorHttp (enabled in capacitor.config.ts) sends these natively, so
// the provider's CORS policy never applies. In a browser it would, which is why
// the web build keeps using api/* instead.
//
// The three adapters mirror api/_llm.js exactly, and the prompts and schemas
// they send come from the same shared/llmTasks.js, so both paths ask the model
// for identical things.
//
// Raw fetch rather than a provider SDK: this is a mobile bundle where a single
// vendor SDK would outweigh all three adapters put together, and the shapes here
// are small and stable. The server path in api/_llm.js does use the official
// Anthropic SDK.

import type { LlmConfig } from './llmConfig'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions'

export class LlmError extends Error {
  code: 'rate_limited' | 'upstream' | 'empty' | 'malformed' | 'refused'
  constructor(code: LlmError['code'], detail = '') {
    super(detail || code)
    this.code = code
  }
}

type Json = Record<string, unknown>

// CapacitorHttp replaces fetch on the native path and its replacement has no
// notion of AbortController — a `signal` is accepted and silently ignored, so a
// request that never answers hangs forever. Racing a timer works either way,
// and is the only thing that does on device.
export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new LlmError('upstream', `${label} timed out after ${ms}ms`)), ms)),
  ])
}

// Anthropic and OpenAI's strict mode reject objects that don't close themselves
// off, and OpenAI additionally wants every property listed in `required`. The
// shared schemas are written for Gemini, which asks for neither.
function strictify(schema: unknown, requireAll: boolean): unknown {
  if (!schema || typeof schema !== 'object') return schema
  if (Array.isArray(schema)) return schema.map(s => strictify(s, requireAll))

  const out: Json = { ...(schema as Json) }
  const props = out.properties
  if (props && typeof props === 'object') {
    const mapped = Object.fromEntries(
      Object.entries(props as Json).map(([k, v]) => [k, strictify(v, requireAll)]),
    )
    out.properties = mapped
    out.additionalProperties = false
    if (requireAll) out.required = Object.keys(mapped)
  }
  if (out.items) out.items = strictify(out.items, requireAll)
  return out
}

async function postJson(url: string, headers: Record<string, string>, body: unknown, label: string) {
  let res: Response
  for (let attempt = 0; ; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 2 ** (attempt - 1) * 1000))
    try {
      // 45s: generation can legitimately take a while, but never forever.
      res = await withTimeout(fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
      }), 45000, label)
    } catch (e) {
      if (e instanceof LlmError) throw e
      throw new LlmError('upstream', `${label} network: ${(e as Error)?.message ?? e}`)
    }
    if (res.status !== 429 || attempt >= 2) break
  }
  if (res.status === 429) throw new LlmError('rate_limited')
  if (!res.ok) throw new LlmError('upstream', `${label} ${res.status} ${await res.text().catch(() => '')}`)
  return res.json()
}

export interface LlmTask {
  system: string
  input: string
  schema: unknown
}

/** system prompt + input + JSON schema → parsed object. Throws LlmError. */
export async function generateJson(cfg: LlmConfig, task: LlmTask): Promise<Json> {
  let raw: string | null = null

  if (cfg.provider === 'gemini') {
    const data = await postJson(GEMINI_URL, { 'x-goog-api-key': cfg.apiKey }, {
      model: cfg.model,
      system_instruction: task.system,
      input: task.input,
      response_format: { type: 'text', mime_type: 'application/json', schema: task.schema },
    }, 'gemini')
    const step = (data.steps as { type: string; content?: { type: string; text?: string }[] }[] | undefined)
      ?.find(s => s.type === 'model_output')
    raw = step?.content?.find(c => c.type === 'text')?.text ?? null

  } else if (cfg.provider === 'anthropic') {
    const data = await postJson('https://api.anthropic.com/v1/messages', {
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
      // Needed when this runs in a real browser; harmless on the native path,
      // where the request never goes through CORS at all.
      'anthropic-dangerous-direct-browser-access': 'true',
    }, {
      model: cfg.model,
      // max_tokens caps thinking and response text together on current models,
      // so a limit sized to the answer alone truncates mid-JSON.
      max_tokens: 16000,
      system: task.system,
      messages: [{ role: 'user', content: task.input }],
      output_config: { format: { type: 'json_schema', schema: strictify(task.schema, false) } },
    }, 'anthropic')
    // Safety classifiers can decline with a normal 200 and empty content.
    if (data.stop_reason === 'refusal') throw new LlmError('refused')
    raw = (data.content as { type: string; text?: string }[] | undefined)
      ?.find(b => b.type === 'text')?.text ?? null

  } else {
    const data = await postJson(`${cfg.baseUrl}/chat/completions`, {
      authorization: `Bearer ${cfg.apiKey}`,
    }, {
      model: cfg.model,
      messages: [
        { role: 'system', content: task.system },
        { role: 'user', content: task.input },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'result', strict: true, schema: strictify(task.schema, true) },
      },
    }, 'openai-compatible')
    raw = (data.choices as { message?: { content?: string } }[] | undefined)?.[0]?.message?.content ?? null
  }

  if (!raw || !raw.trim()) throw new LlmError('empty')
  try {
    return JSON.parse(raw)
  } catch {
    throw new LlmError('malformed', raw.slice(0, 300))
  }
}
