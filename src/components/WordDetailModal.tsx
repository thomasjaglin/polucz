import { useState } from 'react'
import { tagGradients } from '../data/gradients'
import type { VocabEntry, VocabVerb, VocabNoun } from '../data/types'

// ─── Sub-sections ─────────────────────────────────────────────────────────────

function VerbSection({ entry }: { entry: VocabVerb }) {
  return (
    <>
      <div className="mb-8 flex w-full flex-col">
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col">
            <span className="mb-3 font-instrument text-[14px] text-white/20">present</span>
            {entry.conjugations.present.map((c, i) => (
              <span key={`pres-${i}`} className="mb-1.5 font-instrument text-[16px] italic leading-none text-white/80">{c}</span>
            ))}
          </div>
          <div className="flex flex-col">
            <span className="mb-3 font-instrument text-[14px] text-white/20">past</span>
            {entry.conjugations.past.map((c, i) => (
              <span key={`past-${i}`} className="mb-1.5 font-instrument text-[16px] italic leading-none text-white/80">{c}</span>
            ))}
          </div>
          <div className="flex flex-col pt-[34px]">
            {entry.conjugations.past2.map((c, i) => (
              <span key={`past2-${i}`} className="mb-1.5 font-instrument text-[16px] italic leading-none text-white/80">{c}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="my-6 h-[1px] w-full bg-white/10" />

      <div className="mb-2 flex items-center gap-4">
        <span className="font-instrument text-[15px] text-white/20">{entry.otherForm.label}</span>
        <span className="font-instrument text-[18px] italic text-[#B4A0FF]">{entry.otherForm.word}</span>
      </div>
    </>
  )
}

function NounSection({ entry }: { entry: VocabNoun }) {
  return (
    <div className="mb-8 flex w-full flex-col">
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col">
          <span className="mb-3 font-instrument text-[14px] text-white/20">przypadek</span>
          {entry.declensions.cases.map((c, i) => (
            <span key={`case-${i}`} className="mb-1.5 font-instrument text-[16px] italic leading-none text-white/40">{c}</span>
          ))}
        </div>
        <div className="flex flex-col">
          <span className="mb-3 font-instrument text-[14px] text-white/20">li. pojedyncza</span>
          {entry.declensions.singular.map((c, i) => (
            <span key={`sg-${i}`} className="mb-1.5 font-instrument text-[16px] italic leading-none text-white/80">{c}</span>
          ))}
        </div>
        <div className="flex flex-col">
          <span className="mb-3 font-instrument text-[14px] text-white/20">li. mnoga</span>
          {entry.declensions.plural.map((c, i) => (
            <span key={`pl-${i}`} className="mb-1.5 font-instrument text-[16px] italic leading-none text-white/80">{c}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

function FallbackSection({ entry }: { entry: Extract<VocabEntry, { type: 'adjective' | 'unknown' }> }) {
  return (
    <div className="flex flex-col gap-4 rounded-[24px] border border-white/5 bg-white/5 p-5">
      <p className="font-instrument text-[16px] text-white/80">
        {entry.info ?? 'No additional info available.'}
      </p>
    </div>
  )
}

function ExamplesSection() {
  const [loading, setLoading] = useState(false)
  const [shown, setShown] = useState(false)

  function handleFind() {
    if (loading || shown) return
    setLoading(true)
    setTimeout(() => { setLoading(false); setShown(true) }, 800)
  }

  return (
    <>
      {shown && (
        <div className="mt-6 flex flex-col gap-4 border-t border-white/10 pt-6">
          <span className="mb-2 font-instrument text-[14px] text-white/20">Examples</span>
          <div className="flex flex-col gap-5">
            <p className="font-instrument text-[17px] leading-tight text-white/90">
              <span className="text-[#B4A0FF]">Mówię</span> po polsku.{' '}
              <br />
              <span className="mt-1 block text-[14px] text-white/40">I speak Polish.</span>
            </p>
            <p className="font-instrument text-[17px] leading-tight text-white/90">
              Co ty <span className="text-[#B4A0FF]">mówisz</span>?{' '}
              <br />
              <span className="mt-1 block text-[14px] text-white/40">What are you saying?</span>
            </p>
          </div>
        </div>
      )}
      {!shown && (
        <button
          onClick={handleFind}
          className="mt-8 flex w-full items-center justify-center rounded-[24px] bg-white/5 py-4 font-instrument text-[16px] text-white/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] transition-all hover:bg-white/10 hover:text-white"
        >
          {loading
            ? <span className="material-symbols-rounded animate-spin">progress_activity</span>
            : 'Find examples'
          }
        </button>
      )}
    </>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface Props {
  entry: VocabEntry
  flipIn: boolean
  overlayVisible: boolean
  onClose: () => void
}

export default function WordDetailModal({ entry, flipIn, overlayVisible, onClose }: Props) {
  const [refreshing, setRefreshing] = useState(false)

  function handleRefresh() {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1200)
  }

  return (
    <div
      className={`fixed inset-0 z-[100] flex cursor-pointer items-center justify-center bg-black/60 p-6 backdrop-blur-xl transition-opacity duration-300 ${overlayVisible ? 'opacity-100' : 'opacity-0'}`}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`modal-content-wrapper w-full max-w-[400px] cursor-default${flipIn ? ' flip-in' : ''}`}>
        <div className="relative w-full rounded-[40px] bg-gradient-to-br from-white/20 via-white/5 to-transparent p-[1px] shadow-[0_16px_64px_rgba(0,0,0,0.6)]">
          <div className="flex w-full flex-col rounded-[39px] border border-white/5 bg-[#1a1a1a]/95 p-[32px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] backdrop-blur-3xl transition-all duration-300">

            {/* Close button — floats above the card */}
            <button
              onClick={onClose}
              className="absolute -top-16 right-0 z-10 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/70 backdrop-blur-md transition-all hover:bg-white/20 hover:text-white"
            >
              <span className="material-symbols-rounded text-[28px]">close</span>
            </button>

            {/* Top row: type tag + refresh */}
            <div className="mb-8 flex w-full items-center justify-between">
              <div className="relative flex items-center justify-center overflow-hidden rounded-[124px] border border-[#F8FAFC]/20 bg-[#F8FAFC]/10 px-[16px] py-[6px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]">
                <div
                  className="absolute inset-0 z-0 flex items-center justify-center opacity-70 mix-blend-screen"
                  dangerouslySetInnerHTML={{ __html: tagGradients[entry.type] ?? tagGradients['unknown'] }}
                />
                <span className="relative z-10 font-instrument text-[12px] font-medium capitalize text-[#F8FAFC]">
                  {entry.type}
                </span>
              </div>
              <button
                onClick={handleRefresh}
                className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] transition-all hover:bg-white/10 hover:text-white"
              >
                <span className={`material-symbols-rounded text-[20px]${refreshing ? ' animate-spin' : ''}`}>
                  refresh
                </span>
              </button>
            </div>

            {/* Word + translation */}
            <div className="mb-8 flex flex-col gap-1">
              <h1 className="flex items-baseline gap-3 font-instrument text-[42px] font-bold leading-none tracking-tight text-[#F8FAFC]">
                {entry.pl}
                {entry.type === 'noun' && (
                  <span className="text-[24px] font-medium italic text-[#e879f9]">{entry.gender}</span>
                )}
              </h1>
              {entry.type === 'noun' && (
                <h3 className="mb-1 mt-1 font-instrument text-[20px] leading-none text-white/40">{entry.plAlt}</h3>
              )}
              <h2 className="mt-1 font-instrument text-[22px] font-medium text-[#B4A0FF]">{entry.en}</h2>
            </div>

            {/* Type-specific grammatical detail */}
            {entry.type === 'verb'  && <VerbSection entry={entry} />}
            {entry.type === 'noun'  && <NounSection entry={entry} />}
            {(entry.type === 'adjective' || entry.type === 'unknown') && <FallbackSection entry={entry} />}

            {/* AI example sentence section */}
            <ExamplesSection />
          </div>
        </div>
      </div>
    </div>
  )
}
