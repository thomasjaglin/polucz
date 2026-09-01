import { useState } from 'react'
import { llmFetch } from '../lib/llmApi'
import { readLlmError, llmErrorMessage } from '../lib/llmErrors'
import GlassCard from './GlassCard'
import SolidButton from './SolidButton'
import GlassInput from './GlassInput'
import { findByLemma } from '../lib/storage'
import { llmHeaders } from '../lib/llmConfig'
import type { VocabEntry } from '../data/types'

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
      const lemmaRes = await llmFetch('/api/lemmatize', { text: plTrimmed })

      if (!lemmaRes.ok) {
        // Was `err.error`, which put the raw wire code ("not_configured") in
        // front of the user. Map it to something actionable instead.
        throw new Error(llmErrorMessage(await readLlmError(lemmaRes)))
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
    <div className="animate-fade-in flex w-full flex-col gap-6 pt-6">
      {/* Google Sheets import */}
      <GlassCard contentClassName="flex flex-col p-5">
        <h2 className="mb-4 font-instrument text-[18px] font-semibold text-ink">Google Sheets import</h2>
        <GlassInput
          placeholder="Paste link…"
          icon="link"
          value={sheetUrl}
          onChange={setSheetUrl}
          className="mb-4"
        />
        <SolidButton gradient className="w-full" onClick={() => alert('Fetch: ' + sheetUrl)}>Fetch data</SolidButton>
      </GlassCard>

      {/* Manual Add */}
      <GlassCard contentClassName="flex flex-col p-5">
        <h2 className="mb-4 font-instrument text-[18px] font-semibold text-ink">Add manually</h2>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <GlassInput placeholder="PL" value={pl} onChange={v => { setPl(v); if (phase !== 'idle') resetError() }} />
          <GlassInput placeholder="EN (optional)" value={en} onChange={setEn} />
        </div>

        {/* Feedback messages */}
        {phase === 'error' && (
          <p className="mb-3 font-instrument text-[13px] text-err/80">{errorMsg}</p>
        )}
        {phase === 'duplicate' && (
          <p className="mb-3 font-instrument text-[13px] text-amber-400/80">Already in your vocabulary</p>
        )}
        {phase === 'success' && (
          <p className="mb-3 font-instrument text-[13px] text-ok/80">Added! Taking you to your vocab…</p>
        )}

        <SolidButton
          gradient
          className="w-full"
          onClick={handleAddWord}
          disabled={!pl.trim() || phase === 'loading' || phase === 'success'}
        >
          {phase === 'loading' ? 'Adding…' : 'Add word'}
        </SolidButton>
      </GlassCard>
    </div>
  )
}
