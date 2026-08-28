import { useState, type ReactNode } from 'react'
import GlassCard from './GlassCard'
import GlassInput from './GlassInput'
import GlassPane from './GlassPane'
import { haptics } from '../lib/haptics'

interface Props {
  onSave: () => void
}

// One titled group of settings. The page is a stack of these so a new group
// (Appearance, Preferences, …) is a sibling rather than another block bolted
// onto the end of the API card.
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-2 font-instrument text-[13px] font-medium uppercase tracking-wider text-[#F8FAFC]/40">
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
        <p className="font-instrument text-[16px] text-[#F8FAFC]/70">{label}</p>
        {hint && <p className="mt-0.5 font-instrument text-[13px] text-[#F8FAFC]/35">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

export default function ApiConfigPage({ onSave }: Props) {
  const [provider, setProvider] = useState('gemini')
  const [apiKey, setApiKey] = useState('')
  const [hapticsOn, setHapticsOn] = useState(() => localStorage.getItem('polucz_haptics') !== 'false')

  return (
    <div className="animate-fade-in flex w-full flex-col gap-6 pt-6">
      <h1 className="px-2 font-instrument text-[24px] font-semibold text-[#F8FAFC]">App settings</h1>

      <Section title="Appearance">
        {/* Placeholder until the light theme exists. Deliberately inert rather
            than a toggle that moves and changes nothing — the caption says so
            instead of leaving the control to imply it works. */}
        <Row label="Theme" hint="Light mode isn't built yet">
          <div
            aria-disabled
            className="pointer-events-none flex shrink-0 items-center gap-1 rounded-full border border-[#F8FAFC]/10 p-1 opacity-50"
          >
            <span className="rounded-full px-3 py-1 font-instrument text-[13px] text-[#F8FAFC]/40">Light</span>
            <span className="rounded-full bg-[#F8FAFC]/15 px-3 py-1 font-instrument text-[13px] text-[#F8FAFC]">Dark</span>
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
            className={`relative h-[28px] w-[48px] shrink-0 rounded-full border transition-colors ${hapticsOn ? 'border-[#B4A0FF]/40 bg-[#B4A0FF]/30' : 'border-[#F8FAFC]/10 bg-[#F8FAFC]/10'}`}
          >
            <span className={`absolute top-[3px] h-[20px] w-[20px] rounded-full bg-[#F8FAFC] transition-all ${hapticsOn ? 'left-[24px]' : 'left-[3px]'}`} />
          </button>
        </Row>
      </Section>

      <Section title="API">
        <h3 className="mb-4 font-instrument text-[18px] font-semibold text-[#F8FAFC]">LLM Provider</h3>

        {/* Provider select */}
        <div className="relative mb-6 w-full rounded-[36px] border border-[#F8FAFC]/20 shadow-[0_4px_12px_rgba(0,0,0,0.1)] group">
          <GlassPane borderRadius={36} className="absolute inset-0 z-0 rounded-[36px] bg-[#F8FAFC]/10 transition-colors group-focus-within:bg-[#F8FAFC]/15" />
          <select
            value={provider}
            onChange={e => setProvider(e.target.value)}
            className="relative z-10 w-full appearance-none bg-transparent px-[18px] py-3 font-instrument text-[16px] text-[#F8FAFC] outline-none cursor-pointer"
          >
            <option value="gemini" className="bg-[#1a1a1a] text-[#F8FAFC]">Google Gemini</option>
            <option value="claude" className="bg-[#1a1a1a] text-[#F8FAFC]">Anthropic Claude</option>
          </select>
          <span className="material-symbols-rounded pointer-events-none absolute right-4 top-1/2 z-10 -translate-y-1/2 text-[#F8FAFC]/50">
            expand_more
          </span>
        </div>

        <h3 className="mb-4 font-instrument text-[18px] font-semibold text-[#F8FAFC]">API Key</h3>
        <GlassInput
          type="password"
          placeholder="Paste API Key..."
          value={apiKey}
          onChange={setApiKey}
          className="mb-8"
        />

        <button
          onClick={onSave}
          className="relative flex h-[50px] w-full items-center justify-center overflow-hidden rounded-full border border-[#F8FAFC]/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_4px_12px_rgba(0,0,0,0.2)] transition-all hover:scale-[1.02] active:scale-[0.98] group"
        >
          <GlassPane borderRadius={24} className="absolute inset-0 z-0 rounded-full bg-[#F8FAFC]/5 transition-colors group-hover:bg-[#F8FAFC]/10" />
          <span className="relative z-10 font-instrument text-[16px] font-semibold text-[#F8FAFC]">Save Configuration</span>
        </button>
      </Section>
    </div>
  )
}
