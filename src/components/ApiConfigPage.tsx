import { useState, type ReactNode } from 'react'
import GlassCard from './GlassCard'
import GlassInput from './GlassInput'
import GlassPane from './GlassPane'
import { haptics } from '../lib/haptics'
import { getTheme, setTheme, type Theme } from '../lib/theme'
import { CORPUS_ATTRIBUTION } from '../lib/corpusSnapshot'
import { MODELS, PROVIDERS, clearDeepLKey, clearLlmConfig, getDeepLKey, getLlmConfig, saveDeepLKey, saveLlmConfig, type LlmConfig, type Provider } from '../lib/llmConfig'

interface Props {
  onSave: () => void
}

// One titled group of settings. The page is a stack of these so a new group
// (Appearance, Preferences, …) is a sibling rather than another block bolted
// onto the end of the API card.
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-2 font-instrument text-[13px] font-medium uppercase tracking-wider text-ink/40">
        {title}
      </h2>
      <GlassCard contentClassName="flex flex-col p-6">{children}</GlassCard>
    </section>
  )
}

// Label on the left, control on the right — the shape every settings row takes.
function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-instrument text-[16px] text-ink/70">{label}</p>
        {hint && <p className="mt-0.5 font-instrument text-[13px] text-ink/35">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

// Fixed-length stand-in for a saved key. Rendering one bullet per real
// character would leak its length, which is a fingerprint of the provider.
const MASK = '\u2022'.repeat(24)

export default function ApiConfigPage({ onSave }: Props) {
  const [stored, setStored] = useState<LlmConfig | null>(() => getLlmConfig())
  // Editing starts true only when there's nothing saved, so a configured device
  // opens on the locked summary rather than an empty form.
  const [editing, setEditing] = useState(() => getLlmConfig() === null)
  const [provider, setProvider] = useState<Provider>(() => getLlmConfig()?.provider ?? 'gemini')
  const [model, setModel] = useState(() => getLlmConfig()?.model ?? MODELS.gemini[0])
  const [baseUrl, setBaseUrl] = useState(() => getLlmConfig()?.baseUrl ?? '')
  const [apiKey, setApiKey] = useState('')
  const [deeplStored, setDeeplStored] = useState<string | null>(() => getDeepLKey())
  const [deeplEditing, setDeeplEditing] = useState(() => getDeepLKey() === null)
  const [deeplKey, setDeeplKey] = useState('')
  const [theme, setThemeState] = useState<Theme>(() => getTheme())
  const [hapticsOn, setHapticsOn] = useState(() => localStorage.getItem('polucz_haptics') !== 'false')

  return (
    <div className="animate-fade-in flex w-full flex-col gap-6 pt-6">
      <h1 className="px-2 font-instrument text-[24px] font-semibold text-ink">App settings</h1>

      <Section title="Appearance">
        {/* Live. The hint names the scope rather than the control implying the
            whole app is themed — only the vocabulary list is, so far. */}
        <Row label="Theme">
          <div
            role="radiogroup"
            aria-label="Theme"
            className="flex shrink-0 items-center gap-1 rounded-full border border-ink/10 p-1"
          >
            {(['light', 'dark'] as Theme[]).map(t => (
              <button
                key={t}
                role="radio"
                aria-checked={theme === t}
                onClick={() => {
                  if (theme === t) return
                  setTheme(t)
                  setThemeState(t)
                  haptics.tap()
                }}
                className={`rounded-full px-3 py-1 font-instrument text-[13px] capitalize transition-colors ${
                  theme === t ? 'bg-ink/15 text-ink' : 'text-ink/40'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </Row>
      </Section>

      <Section title="Preferences">
        <Row label="Haptic feedback">
          <button
            role="switch"
            aria-checked={hapticsOn}
            aria-label="Haptic feedback"
            onClick={() => {
              const next = !hapticsOn
              setHapticsOn(next)
              localStorage.setItem('polucz_haptics', next ? 'true' : 'false')
              if (next) haptics.tap()
            }}
            className={`relative h-[28px] w-[48px] shrink-0 rounded-full border transition-colors ${hapticsOn ? 'border-accent/40 bg-accent/30' : 'border-ink/10 bg-ink/10'}`}
          >
            <span // The knob is a surface riding on the track, not text — it stays light in
            // both themes rather than flipping with the ink token.
            className={`absolute top-[3px] h-[20px] w-[20px] rounded-full bg-white shadow-sm transition-all ${hapticsOn ? 'left-[24px]' : 'left-[3px]'}`} />
          </button>
        </Row>
      </Section>

      <Section title="API">
        <p className="mb-5 font-instrument text-[13px] leading-relaxed text-ink/40">
          Run the app's language features through your own LLM. A key is required:
          without one, examples, card details and sentence breakdowns won't load.
        </p>

        <h3 className="mb-3 font-instrument text-[15px] font-semibold text-ink">Provider</h3>
        <div className="relative mb-5 w-full rounded-[36px] border border-ink/20 shadow-[0_4px_12px_rgba(0,0,0,0.1)] group">
          <GlassPane borderRadius={36} className="absolute inset-0 z-0 rounded-[36px] pane-field transition-colors" />
          <select
            value={provider}
            disabled={!editing}
            onChange={e => {
              const next = e.target.value as Provider
              setProvider(next)
              // Model IDs don't carry across providers, so reset rather than
              // leave a name the new provider will 404 on.
              setModel(MODELS[next][0] ?? '')
            }}
            className={`relative z-10 w-full appearance-none bg-transparent px-[18px] py-3 font-instrument text-[16px] text-ink outline-none ${editing ? 'cursor-pointer' : 'opacity-60'}`}
          >
            {PROVIDERS.map(p => (
              <option key={p.id} value={p.id} className="bg-surface text-ink">{p.label}</option>
            ))}
          </select>
          {editing && (
            <span className="material-symbols-rounded pointer-events-none absolute right-4 top-1/2 z-10 -translate-y-1/2 text-ink/50">
              expand_more
            </span>
          )}
        </div>

        {provider === 'openai-compatible' && (
          <>
            <h3 className="mb-3 font-instrument text-[15px] font-semibold text-ink">Base URL</h3>
            <GlassInput
              placeholder="https://api.groq.com/openai/v1"
              value={baseUrl}
              onChange={setBaseUrl}
              disabled={!editing}
              className="mb-5"
            />
          </>
        )}

        <h3 className="mb-3 font-instrument text-[15px] font-semibold text-ink">Model</h3>
        {MODELS[provider].length > 0 ? (
          <div className="relative mb-5 w-full rounded-[36px] border border-ink/20 shadow-[0_4px_12px_rgba(0,0,0,0.1)] group">
            <GlassPane borderRadius={36} className="absolute inset-0 z-0 rounded-[36px] pane-field transition-colors" />
            <select
              value={model}
              disabled={!editing}
              onChange={e => setModel(e.target.value)}
              className={`relative z-10 w-full appearance-none bg-transparent px-[18px] py-3 font-instrument text-[16px] text-ink outline-none ${editing ? 'cursor-pointer' : 'opacity-60'}`}
            >
              {MODELS[provider].map(m => (
                <option key={m} value={m} className="bg-surface text-ink">{m}</option>
              ))}
            </select>
            {editing && (
              <span className="material-symbols-rounded pointer-events-none absolute right-4 top-1/2 z-10 -translate-y-1/2 text-ink/50">
                expand_more
              </span>
            )}
          </div>
        ) : (
          // No catalogue to offer: the base URL can point at any of hundreds of
          // models, so the name is typed rather than picked.
          <GlassInput
            placeholder="Model name, e.g. llama-3.3-70b-versatile"
            value={model}
            onChange={setModel}
            disabled={!editing}
            className="mb-5"
          />
        )}

        <h3 className="mb-3 font-instrument text-[15px] font-semibold text-ink">API Key</h3>
        <GlassInput
          type="password"
          placeholder="Paste API Key..."
          value={editing ? apiKey : MASK}
          onChange={setApiKey}
          disabled={!editing}
          className="mb-6"
        />

        {editing ? (
          <div className="flex gap-3">
            {stored && (
              <button
                onClick={() => {
                  setEditing(false)
                  setApiKey('')
                  setProvider(stored.provider)
                  setModel(stored.model)
                  setBaseUrl(stored.baseUrl)
                }}
                className="relative flex h-[50px] flex-1 items-center justify-center overflow-hidden rounded-full border border-ink/20 transition-all hover:scale-[1.02] active:scale-[0.98] group"
              >
                <GlassPane borderRadius={24} className="absolute inset-0 z-0 rounded-full bg-ink/5 transition-colors group-hover:bg-ink/10" />
                <span className="relative z-10 font-instrument text-[16px] text-ink/70">Cancel</span>
              </button>
            )}
            <button
              onClick={() => {
                const trimmedKey = apiKey.trim()
                const trimmedModel = model.trim()
                const trimmedUrl = baseUrl.trim()
                // An incomplete config would be silently ignored by llmHeaders()
                // and the app would quietly keep using the server key, so refuse
                // to save one rather than look configured when it isn't.
                if (!trimmedKey || !trimmedModel) return
                if (provider === 'openai-compatible' && !trimmedUrl) return
                const next: LlmConfig = { provider, model: trimmedModel, apiKey: trimmedKey, baseUrl: trimmedUrl }
                saveLlmConfig(next)
                setStored(next)
                setApiKey('')
                setEditing(false)
                haptics.tap()
                onSave()
              }}
              className="relative flex h-[50px] flex-1 items-center justify-center overflow-hidden rounded-full border border-ink/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_4px_12px_rgba(0,0,0,0.2)] transition-all hover:scale-[1.02] active:scale-[0.98] group"
            >
              <GlassPane borderRadius={24} className="absolute inset-0 z-0 rounded-full bg-ink/5 transition-colors group-hover:bg-ink/10" />
              <span className="relative z-10 font-instrument text-[16px] font-semibold text-ink">Save Configuration</span>
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => {
                // Clear the fields rather than pre-fill them: the stored key is
                // never readable back, so an edit always means entering a new one.
                setEditing(true)
                setApiKey('')
              }}
              className="relative flex h-[50px] flex-1 items-center justify-center overflow-hidden rounded-full border border-ink/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_4px_12px_rgba(0,0,0,0.2)] transition-all hover:scale-[1.02] active:scale-[0.98] group"
            >
              <GlassPane borderRadius={24} className="absolute inset-0 z-0 rounded-full bg-ink/5 transition-colors group-hover:bg-ink/10" />
              <span className="relative z-10 font-instrument text-[16px] font-semibold text-ink">Change API key</span>
            </button>
            <button
              onClick={() => {
                clearLlmConfig()
                setStored(null)
                setEditing(true)
                setApiKey('')
                setProvider('gemini')
                setModel(MODELS.gemini[0])
                setBaseUrl('')
                haptics.destructive()
              }}
              aria-label="Remove saved key"
              className="relative flex h-[50px] w-[50px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-ink/20 transition-all hover:scale-[1.02] active:scale-[0.98] group"
            >
              <GlassPane borderRadius={24} className="absolute inset-0 z-0 rounded-full bg-ink/5 transition-colors group-hover:bg-ink/10" />
              <span className="material-symbols-rounded relative z-10 text-[20px] text-ink/60">delete</span>
            </button>
          </div>
        )}
      </Section>

      <Section title="Translation">
        <p className="mb-5 font-instrument text-[13px] leading-relaxed text-ink/40">
          The translate page uses DeepL, which is a separate service from the LLM above
          and needs its own key. Free-tier keys end in <span className="font-mono">:fx</span>.
        </p>

        <h3 className="mb-3 font-instrument text-[15px] font-semibold text-ink">DeepL API Key</h3>
        <GlassInput
          type="password"
          placeholder="Paste DeepL API Key..."
          value={deeplEditing ? deeplKey : MASK}
          onChange={setDeeplKey}
          disabled={!deeplEditing}
          className="mb-6"
        />

        {deeplEditing ? (
          <div className="flex gap-3">
            {deeplStored && (
              <button
                onClick={() => { setDeeplEditing(false); setDeeplKey('') }}
                className="relative flex h-[50px] flex-1 items-center justify-center overflow-hidden rounded-full border border-ink/20 transition-all hover:scale-[1.02] active:scale-[0.98] group"
              >
                <GlassPane borderRadius={24} className="absolute inset-0 z-0 rounded-full bg-ink/5 transition-colors group-hover:bg-ink/10" />
                <span className="relative z-10 font-instrument text-[16px] text-ink/70">Cancel</span>
              </button>
            )}
            <button
              onClick={() => {
                const k = deeplKey.trim()
                if (!k) return
                saveDeepLKey(k)
                setDeeplStored(k)
                setDeeplKey('')
                setDeeplEditing(false)
                haptics.tap()
              }}
              className="relative flex h-[50px] flex-1 items-center justify-center overflow-hidden rounded-full border border-ink/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_4px_12px_rgba(0,0,0,0.2)] transition-all hover:scale-[1.02] active:scale-[0.98] group"
            >
              <GlassPane borderRadius={24} className="absolute inset-0 z-0 rounded-full bg-ink/5 transition-colors group-hover:bg-ink/10" />
              <span className="relative z-10 font-instrument text-[16px] font-semibold text-ink">Save DeepL key</span>
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => { setDeeplEditing(true); setDeeplKey('') }}
              className="relative flex h-[50px] flex-1 items-center justify-center overflow-hidden rounded-full border border-ink/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_4px_12px_rgba(0,0,0,0.2)] transition-all hover:scale-[1.02] active:scale-[0.98] group"
            >
              <GlassPane borderRadius={24} className="absolute inset-0 z-0 rounded-full bg-ink/5 transition-colors group-hover:bg-ink/10" />
              <span className="relative z-10 font-instrument text-[16px] font-semibold text-ink">Change DeepL key</span>
            </button>
            <button
              onClick={() => {
                clearDeepLKey()
                setDeeplStored(null)
                setDeeplEditing(true)
                setDeeplKey('')
                haptics.destructive()
              }}
              aria-label="Remove saved DeepL key"
              className="relative flex h-[50px] w-[50px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-ink/20 transition-all hover:scale-[1.02] active:scale-[0.98] group"
            >
              <GlassPane borderRadius={24} className="absolute inset-0 z-0 rounded-full bg-ink/5 transition-colors group-hover:bg-ink/10" />
              <span className="material-symbols-rounded relative z-10 text-[20px] text-ink/60">delete</span>
            </button>
          </div>
        )}
      </Section>

      <Section title="About">
        <Row label="Polucz" hint={`Version ${__APP_VERSION__}`}>
          <span className="material-symbols-rounded text-[22px] text-ink/30">school</span>
        </Row>

        {/* The corpus is CC BY 2.0 FR: crediting Tatoeba is a licence
            obligation, not a courtesy. The quiz credits it where its sentences
            appear, but that view is conditional — this one always renders. */}
        <p className="mt-5 font-instrument text-[13px] leading-relaxed text-ink/45">
          {CORPUS_ATTRIBUTION}. Example sentences come from tatoeba.org and are
          used under CC BY 2.0 FR.
        </p>
        <p className="mt-3 font-instrument text-[13px] leading-relaxed text-ink/45">
          Pronunciation uses your device&rsquo;s own speech engine. Your vocabulary,
          review history and API keys are stored on this device only.
        </p>
      </Section>
    </div>
  )
}
