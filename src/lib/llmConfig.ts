// Which LLM the app's own endpoints call on this device.
//
// On Android the app calls the provider directly with this key; there is no
// server involved and no fallback, so without a config the language features
// return 503 not_configured. In the browser the key is sent as a request header
// and used by api/_llm.js for that request only — nothing is stored
// server-side.
//
// The key lives in localStorage, like every other preference here. That is the
// normal shape for a bring-your-own-key app and it means any script that runs
// on this origin can read it — acceptable for a personal app, worth knowing
// before this is handed to anyone else.

export type Provider = 'gemini' | 'anthropic' | 'openai-compatible'

export interface LlmConfig {
  provider: Provider
  model: string
  apiKey: string
  /** openai-compatible only: the endpoint root, e.g. https://api.groq.com/openai/v1 */
  baseUrl: string
}

export const PROVIDERS: { id: Provider; label: string }[] = [
  { id: 'gemini', label: 'Google Gemini' },
  { id: 'anthropic', label: 'Anthropic Claude' },
  { id: 'openai-compatible', label: 'OpenAI-compatible' },
]

// Only model IDs verified against each provider's current line-up. An unlisted
// model is a 404 at request time, so this list stays short rather than
// speculative — add a line when a new one is confirmed.
//
// openai-compatible is deliberately empty: the base URL points anywhere
// (Groq, OpenRouter, Together, a local Ollama), so there is no catalogue to
// curate and the model is entered as free text instead.
export const MODELS: Record<Provider, string[]> = {
  gemini: ['gemini-3.5-flash'],
  anthropic: ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'],
  'openai-compatible': [],
}

const KEY = 'polucz_llm_config'

export function getLlmConfig(): LlmConfig | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as Partial<LlmConfig>
    if (!c.provider || !c.apiKey || !c.model) return null
    if (!PROVIDERS.some(p => p.id === c.provider)) return null
    // An openai-compatible config without an endpoint can't be dialled.
    if (c.provider === 'openai-compatible' && !c.baseUrl) return null
    return { provider: c.provider, model: c.model, apiKey: c.apiKey, baseUrl: c.baseUrl ?? '' }
  } catch {
    return null
  }
}

export function saveLlmConfig(config: LlmConfig) {
  localStorage.setItem(KEY, JSON.stringify(config))
}

export function clearLlmConfig() {
  localStorage.removeItem(KEY)
}

// Spread into an LLM endpoint's fetch headers. Empty when nothing is stored,
// which is what selects the server's own key.
export function llmHeaders(): Record<string, string> {
  const c = getLlmConfig()
  if (!c) return { ...deeplHeaders() }
  const h: Record<string, string> = {
    'x-llm-provider': c.provider,
    'x-llm-model': c.model,
    'x-llm-key': c.apiKey,
  }
  if (c.baseUrl) h['x-llm-base-url'] = c.baseUrl
  return { ...h, ...deeplHeaders() }
}

// Sent alongside llmHeaders() so the browser build uses the user's DeepL key
// too, rather than only the native path honouring it.
export function deeplHeaders(): Record<string, string> {
  const k = getDeepLKey()
  return k ? { 'x-deepl-key': k } : {}
}

// ─── DeepL ──────────────────────────────────────────────────────────────────
// Translation is DeepL, not an LLM, so it has its own key. Kept separate rather
// than folded into LlmConfig because the two are independently useful: a user
// may set one and not the other, and each feature should work on its own.

const DEEPL_KEY = 'polucz_deepl_key'

export function getDeepLKey(): string | null {
  try {
    return localStorage.getItem(DEEPL_KEY) || null
  } catch {
    return null
  }
}

export function saveDeepLKey(key: string) {
  localStorage.setItem(DEEPL_KEY, key)
}

export function clearDeepLKey() {
  localStorage.removeItem(DEEPL_KEY)
}
