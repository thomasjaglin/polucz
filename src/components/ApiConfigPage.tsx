import { useState } from 'react'
import GlassCard from './GlassCard'
import GlassInput from './GlassInput'
import GlassPane from './GlassPane'

interface Props {
  onSave: () => void
}

export default function ApiConfigPage({ onSave }: Props) {
  const [provider, setProvider] = useState('gemini')
  const [apiKey, setApiKey] = useState('')

  return (
    <div className="animate-fade-in flex w-full flex-col gap-6 pt-[24px]">
      <GlassCard contentClassName="flex flex-col p-[24px]">
        <h2 className="mb-4 font-instrument text-[18px] font-semibold text-[#F8FAFC]">LLM Provider</h2>

        {/* Provider select */}
        <div className="relative mb-6 w-full rounded-[32px] border border-[#F8FAFC]/20 shadow-[0_4px_12px_rgba(0,0,0,0.1)] group">
          <GlassPane borderRadius={32} className="absolute inset-0 z-0 rounded-[32px] bg-[#F8FAFC]/10 transition-colors group-focus-within:bg-[#F8FAFC]/15" />
          <select
            value={provider}
            onChange={e => setProvider(e.target.value)}
            className="relative z-10 w-full appearance-none bg-transparent px-[18px] py-[12px] font-instrument text-[16px] text-[#F8FAFC] outline-none cursor-pointer"
          >
            <option value="gemini" className="bg-[#1a1a1a] text-[#F8FAFC]">Google Gemini</option>
            <option value="claude" className="bg-[#1a1a1a] text-[#F8FAFC]">Anthropic Claude</option>
          </select>
          <span className="material-symbols-rounded pointer-events-none absolute right-4 top-1/2 z-10 -translate-y-1/2 text-white/50">
            expand_more
          </span>
        </div>

        <h2 className="mb-4 font-instrument text-[18px] font-semibold text-[#F8FAFC]">API Key</h2>
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
          <GlassPane borderRadius={25} className="absolute inset-0 z-0 rounded-full bg-[#F8FAFC]/5 transition-colors group-hover:bg-[#F8FAFC]/10" />
          <span className="relative z-10 font-instrument text-[16px] font-semibold text-[#F8FAFC]">Save Configuration</span>
        </button>
      </GlassCard>
    </div>
  )
}
