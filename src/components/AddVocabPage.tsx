import { useState } from 'react'
import GlassCard from './GlassCard'
import GlassInput from './GlassInput'

function GlassButton({
  label,
  gradient,
  onClick,
}: {
  label: string
  gradient?: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex h-[50px] w-full items-center justify-center overflow-hidden rounded-full border border-[#F8FAFC]/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_4px_12px_rgba(0,0,0,0.2)] transition-all hover:scale-[1.02] active:scale-[0.98] group"
    >
      <div className="absolute inset-0 z-0 rounded-full bg-[#F8FAFC]/5 transition-colors group-hover:bg-[#F8FAFC]/10" />
      {gradient && (
        <div className="absolute inset-0 z-10 flex items-center justify-center opacity-90 mix-blend-screen">
          {gradient}
        </div>
      )}
      <span className="relative z-20 font-instrument text-[16px] font-semibold text-[#F8FAFC]">{label}</span>
    </button>
  )
}

const purpleGradient = (
  <svg className="h-full w-full object-cover" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 376 64" fill="none" preserveAspectRatio="none">
    <rect x="21.8" y="21.8" width="332" height="26" rx="13" fill="#5D05A5" filter="blur(10.9px)" />
    <rect x="30.5883" y="29.5449" width="314.424" height="18.2553" rx="9.12766" fill="#AB32C9" filter="blur(10.9px)" />
    <rect x="73.553" y="31.7576" width="264.624" height="13.8298" rx="6.91489" fill="#925BDF" filter="blur(10.9px)" />
  </svg>
)

const orangeGradient = (
  <svg className="h-full w-full object-cover" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 376 64" fill="none" preserveAspectRatio="none">
    <rect x="21.8" y="21.8" width="332" height="26" rx="13" fill="#B00303" filter="blur(10.9px)" />
    <rect x="30.5883" y="29.5449" width="314.424" height="18.2553" rx="9.12766" fill="#C9A132" filter="blur(10.9px)" />
    <rect x="73.553" y="31.7576" width="264.624" height="13.8298" rx="6.91489" fill="#DFAA5B" filter="blur(10.9px)" />
  </svg>
)

export default function AddVocabPage() {
  const [sheetUrl, setSheetUrl] = useState('')
  const [pl, setPl] = useState('')
  const [en, setEn] = useState('')

  return (
    <div className="animate-fade-in flex w-full flex-col gap-6 pt-[24px]">
      {/* Google Sheets Import */}
      <GlassCard contentClassName="flex flex-col p-[20px]">
        <h2 className="mb-4 font-instrument text-[18px] font-semibold text-[#F8FAFC]">Google Sheets Import</h2>
        <GlassInput
          placeholder="Paste link..."
          icon="link"
          value={sheetUrl}
          onChange={setSheetUrl}
          className="mb-4"
        />
        <GlassButton label="Fetch Data" gradient={purpleGradient} onClick={() => alert('Fetch: ' + sheetUrl)} />
      </GlassCard>

      {/* Manual Add */}
      <GlassCard contentClassName="flex flex-col p-[20px]">
        <h2 className="mb-4 font-instrument text-[18px] font-semibold text-[#F8FAFC]">Add Manually</h2>
        <div className="mb-4 grid grid-cols-2 gap-[12px]">
          <GlassInput placeholder="PL" value={pl} onChange={setPl} />
          <GlassInput placeholder="EN" value={en} onChange={setEn} />
        </div>
        <GlassButton label="Add Word" gradient={orangeGradient} onClick={() => { if (pl && en) { setPl(''); setEn('') } }} />
      </GlassCard>
    </div>
  )
}
