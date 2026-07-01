import { useState } from 'react'
import GlassCard from './GlassCard'
import GlassInput from './GlassInput'
import { findByLemma } from '../lib/storage'
import type { VocabEntry } from '../data/types'

function GlassButton({
  label,
  gradient,
  onClick,
  disabled,
}: {
  label: string
  gradient?: React.ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="relative flex h-[50px] w-full items-center justify-center overflow-hidden rounded-full border border-[#F8FAFC]/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_4px_12px_rgba(0,0,0,0.2)] transition-all hover:scale-[1.02] active:scale-[0.98] group disabled:pointer-events-none disabled:opacity-40"
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

type Phase = 'idle' | 'loading' | 'success' | 'duplicate' | 'error'

interface Props {
  onAddCard: (entry: VocabEntry) => void
  onSuccess: () => void
}

export default function AddVocabPage({ onAddCard, onSuccess }: Props) {
  const [sheetUrl, setSheetUrl] = useState('')
  const [pl, setPl] = useState('')
  const [en, setEn] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleAddWord() {
    const plTrimmed = pl.trim()
    if (!plTrimmed) return
    setPhase('loading')
    setErrorMsg('')

    try {
      const lemmaRes = await fetch('/api/lemmatize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: plTrimmed }),
      })

      if (!lemmaRes.ok) {
        const err = await lemmaRes.json().catch(() => ({}))
        throw new Error(err.error ?? 'Lemmatization failed')
      }
      const { lemma, type, gender, canonicalEn } = await lemmaRes.json()

      // Prefer the user-provided EN; fall back to canonical form from Gemini
      const resolvedEn = en.trim() || canonicalEn || lemma

      // Deduplicate by lemma
      if (findByLemma(lemma)) {
        setPhase('duplicate')
        return
      }

      // Build entry — grammar tables filled by deferred enrichment on first modal open
      let entry: VocabEntry
      if (type === 'verb') {
        entry = { id: lemma, enriched: false, pl: lemma, en: resolvedEn, left: '', right: '', tags: ['verb'], type: 'verb', conjugations: null, otherForm: null }
      } else if (type === 'noun') {
        const g = (gender as string) || ''
        entry = { id: lemma, enriched: false, pl: lemma, en: resolvedEn, left: g, right: '', tags: ['noun'], type: 'noun', gender: g, plAlt: '', declensions: null }
      } else if (type === 'adjective') {
        entry = { id: lemma, enriched: false, pl: lemma, en: resolvedEn, left: 'adj', right: '', tags: ['adjective'], type: 'adjective', declensions: null }
      } else {
        entry = { id: lemma, enriched: false, pl: lemma, en: resolvedEn, left: '', right: '', tags: ['unknown'], type: 'unknown' }
      }

      onAddCard(entry)
      setPl('')
      setEn('')
      setPhase('success')
      setTimeout(() => { setPhase('idle'); onSuccess() }, 1200)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setPhase('error')
    }
  }

  function resetError() {
    setPhase('idle')
    setErrorMsg('')
  }

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
          <GlassInput placeholder="PL" value={pl} onChange={v => { setPl(v); if (phase !== 'idle') resetError() }} />
          <GlassInput placeholder="EN (optional)" value={en} onChange={setEn} />
        </div>

        {/* Feedback messages */}
        {phase === 'error' && (
          <p className="mb-3 font-instrument text-[13px] text-red-400/80">{errorMsg}</p>
        )}
        {phase === 'duplicate' && (
          <p className="mb-3 font-instrument text-[13px] text-amber-400/80">Already in your vocabulary.</p>
        )}
        {phase === 'success' && (
          <p className="mb-3 font-instrument text-[13px] text-emerald-400/80">Added! Taking you to your vocab…</p>
        )}

        <GlassButton
          label={phase === 'loading' ? 'Adding…' : 'Add Word'}
          gradient={orangeGradient}
          onClick={handleAddWord}
          disabled={!pl.trim() || phase === 'loading' || phase === 'success'}
        />
      </GlassCard>
    </div>
  )
}
