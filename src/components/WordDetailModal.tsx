import { useState, useEffect, useRef } from 'react'
import { tagGradients } from '../data/gradients'
import type {
  VocabEntry, VocabVerb, VocabNoun, VocabAdjective, VocabUnknown,
  VerbConjugations, NounDeclensions, AdjectiveDeclensions,
} from '../data/types'
import GlassPane from './GlassPane'
import GlassButton from './GlassButton'
import { useTTS } from '../lib/useTTS'
import { haptics } from '../lib/haptics'
import { getGlassMode } from '../lib/glassMode'

function mergeEnrichment(entry: VocabEntry, data: Record<string, unknown>): VocabEntry {
  const base = { ...entry, enriched: true }
  if (base.type === 'verb') {
    const aspect = typeof data.aspect === 'string' && data.aspect ? data.aspect : base.left
    return { ...base, left: aspect, conjugations: data.conjugations as VerbConjugations, otherForm: data.otherForm as { label: string; word: string } }
  }
  if (base.type === 'noun') {
    return { ...base, declensions: data.declensions as NounDeclensions, plAlt: data.plAlt as string }
  }
  if (base.type === 'adjective') {
    return { ...base, declensions: data.declensions as AdjectiveDeclensions }
  }
  if (base.type === 'unknown') {
    return { ...base, info: data.info as string }
  }
  return base
}

const CASE_ABBREV: Record<string, string> = {
  'mianownik':  'm.',
  'dopełniacz': 'd.',
  'celownik':   'c.',
  'biernik':    'b.',
  'narzędnik':  'n.',
  'miejscownik':'ms.',
  'wołacz':     'w.',
}
const abbrev = (c: string) => CASE_ABBREV[c] ?? c

// ─── Sub-sections ─────────────────────────────────────────────────────────────

function EnrichingSkeleton() {
  return (
    <div className="mb-8 flex flex-col items-center gap-3 py-6 text-white/30">
      <span className="material-symbols-rounded animate-spin text-[28px]">progress_activity</span>
      <span className="font-instrument text-[14px]">Loading grammar…</span>
    </div>
  )
}

function VerbSection({ entry }: { entry: VocabVerb }) {
  if (!entry.conjugations) return <EnrichingSkeleton />
  return (
    <>
      <div className="mb-8 flex w-full flex-col">
        <div className="grid grid-cols-3 gap-2 [&>*]:min-w-0">
          <div className="flex flex-col">
            <span className="mb-3 font-instrument text-[14px] text-white/20">present</span>
            {entry.conjugations.present.map((c, i) => (
              <span key={`pres-${i}`} className="mb-1.5 break-words font-instrument text-[16px] italic leading-tight text-white/80">{c}</span>
            ))}
          </div>
          <div className="flex flex-col">
            <span className="mb-3 font-instrument text-[14px] text-white/20">past m.</span>
            {entry.conjugations.past.map((c, i) => (
              <span key={`past-${i}`} className="mb-1.5 break-words font-instrument text-[16px] italic leading-tight text-white/80">{c}</span>
            ))}
          </div>
          <div className="flex flex-col">
            <span className="mb-3 font-instrument text-[14px] text-white/20">past f.</span>
            {entry.conjugations.past2.map((c, i) => (
              <span key={`past2-${i}`} className="mb-1.5 break-words font-instrument text-[16px] italic leading-tight text-white/80">{c}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="my-6 h-[1px] w-full bg-white/10" />

      {entry.otherForm && (
        <div className="mb-2 flex items-center gap-4">
          <span className="font-instrument text-[15px] text-white/20">{entry.otherForm.label}</span>
          <span className="font-instrument text-[18px] italic text-[#B4A0FF]">{entry.otherForm.word}</span>
        </div>
      )}
    </>
  )
}

function NounSection({ entry }: { entry: VocabNoun }) {
  if (!entry.declensions) return <EnrichingSkeleton />
  return (
    <div className="mb-8 flex w-full flex-col">
      <div className="grid grid-cols-[0.5fr_1fr_1fr] gap-2 [&>*]:min-w-0">
        <div className="flex flex-col">
          <span className="mb-3 font-instrument text-[14px] text-white/20">p.</span>
          {entry.declensions.cases.map((c, i) => (
            <span key={`case-${i}`} className="mb-1.5 font-instrument text-[16px] italic leading-tight text-white/40">{abbrev(c)}</span>
          ))}
        </div>
        <div className="flex flex-col">
          <span className="mb-3 font-instrument text-[14px] text-white/20">li. pojedyncza</span>
          {entry.declensions.singular.map((c, i) => (
            <span key={`sg-${i}`} className="mb-1.5 break-words font-instrument text-[16px] italic leading-tight text-white/80">{c}</span>
          ))}
        </div>
        <div className="flex flex-col">
          <span className="mb-3 font-instrument text-[14px] text-white/20">li. mnoga</span>
          {entry.declensions.plural.map((c, i) => (
            <span key={`pl-${i}`} className="mb-1.5 break-words font-instrument text-[16px] italic leading-tight text-white/80">{c}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

function AdjectiveSection({ entry }: { entry: VocabAdjective }) {
  if (!entry.declensions) return <EnrichingSkeleton />
  const { cases, masculine, feminine, neuter, pluralMasc, pluralNonMasc } = entry.declensions
  return (
    <div className="mb-8 flex w-full flex-col gap-6">
      {/* Singular: 4 columns — cases, m., f., n. */}
      <div className="flex flex-col">
        <span className="mb-3 font-instrument text-[12px] uppercase tracking-wider text-white/20">li. pojedyncza</span>
        <div className="grid grid-cols-[0.5fr_1fr_1fr_1fr] gap-1.5 [&>*]:min-w-0">
          <div className="flex flex-col">
            <span className="mb-2.5 font-instrument text-[11px] text-white/20">p.</span>
            {cases.map((c, i) => (
              <span key={`adj-case-${i}`} className="mb-1 font-instrument text-[12px] italic leading-tight text-white/40">{abbrev(c)}</span>
            ))}
          </div>
          <div className="flex flex-col">
            <span className="mb-2.5 font-instrument text-[11px] text-white/20">m.</span>
            {masculine.map((c, i) => (
              <span key={`adj-m-${i}`} className="mb-1 break-words font-instrument text-[12px] italic leading-tight text-white/80">{c}</span>
            ))}
          </div>
          <div className="flex flex-col">
            <span className="mb-2.5 font-instrument text-[11px] text-white/20">f.</span>
            {feminine.map((c, i) => (
              <span key={`adj-f-${i}`} className="mb-1 break-words font-instrument text-[12px] italic leading-tight text-white/80">{c}</span>
            ))}
          </div>
          <div className="flex flex-col">
            <span className="mb-2.5 font-instrument text-[11px] text-white/20">n.</span>
            {neuter.map((c, i) => (
              <span key={`adj-n-${i}`} className="mb-1 break-words font-instrument text-[12px] italic leading-tight text-white/80">{c}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="h-[1px] w-full bg-white/10" />

      {/* Plural: 3 columns — cases, m.os. (virile), nm.os. (non-virile) */}
      <div className="flex flex-col">
        <span className="mb-3 font-instrument text-[12px] uppercase tracking-wider text-white/20">li. mnoga</span>
        <div className="grid grid-cols-[0.5fr_1fr_1fr] gap-1.5 [&>*]:min-w-0">
          <div className="flex flex-col">
            <span className="mb-2.5 font-instrument text-[11px] text-white/20">p.</span>
            {cases.map((c, i) => (
              <span key={`adj-case2-${i}`} className="mb-1 font-instrument text-[12px] italic leading-tight text-white/40">{abbrev(c)}</span>
            ))}
          </div>
          <div className="flex flex-col">
            <span className="mb-2.5 font-instrument text-[11px] text-white/20">m.os.</span>
            {pluralMasc.map((c, i) => (
              <span key={`adj-pm-${i}`} className="mb-1 break-words font-instrument text-[12px] italic leading-tight text-white/80">{c}</span>
            ))}
          </div>
          <div className="flex flex-col">
            <span className="mb-2.5 font-instrument text-[11px] text-white/20">nm.os.</span>
            {pluralNonMasc.map((c, i) => (
              <span key={`adj-pnm-${i}`} className="mb-1 break-words font-instrument text-[12px] italic leading-tight text-white/80">{c}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function FallbackSection({ entry }: { entry: VocabUnknown }) {
  return (
    <div className="flex flex-col gap-4 rounded-[24px] border border-white/5 bg-white/5 p-5">
      <p className="font-instrument text-[16px] text-white/80">
        {entry.info ?? 'No additional info available.'}
      </p>
    </div>
  )
}

function ExamplesSection({ word }: { word: string }) {
  const [loading, setLoading] = useState(false)
  const [translation, setTranslation] = useState<string | null>(null)
  const [error, setError] = useState(false)

  async function handleFind() {
    if (loading || translation) return
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: word }),
      })
      const data = await res.json()
      if (data.translation) setTranslation(data.translation)
      else setError(true)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  if (translation) {
    return (
      <div className="mt-6 flex flex-col gap-4 border-t border-white/10 pt-6">
        <span className="mb-2 font-instrument text-[14px] text-white/20">Translation</span>
        <p className="font-instrument text-[20px] italic text-[#B4A0FF]">{translation}</p>
      </div>
    )
  }

  return (
    <GlassButton
      onClick={handleFind}
      disabled={loading}
      radius={24}
      pane="bg-white/5"
      className="mt-8 w-full py-4 font-instrument text-[16px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
    >
      {loading ? (
        <span className="material-symbols-rounded animate-spin text-white/40">progress_activity</span>
      ) : error ? (
        <>
          <span className="material-symbols-rounded text-[16px] text-red-400/70">error</span>
          <span className="text-white/30">Unavailable — tap to retry</span>
        </>
      ) : (
        <span className="text-white/40">Fetch examples</span>
      )}
    </GlassButton>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface Props {
  entry: VocabEntry
  flipIn: boolean
  overlayVisible: boolean
  onClose: () => void
  onEnriched: (updated: VocabEntry) => void
  onDelete: () => void
}

export default function WordDetailModal({ entry, flipIn, overlayVisible, onClose, onEnriched, onDelete }: Props) {
  const [enriching, setEnriching] = useState(false)
  const [enrichError, setEnrichError] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const tts = useTTS()
  const backdropLastTap = useRef(0)
  const glassMode = getGlassMode()
  // Temporary: mix-blend-screen(blob, black) is a no-op mathematically, so
  // if the canvas is correctly outputting black behind the blobs, the debug
  // rim-strength visualization (?debugpanes=2) would be invisible even
  // though the canvas is right — hide the blobs during that diagnostic to
  // see the canvas's raw output in isolation. Safe to remove once resolved.
  const hideBlobsForDebug = new URLSearchParams(window.location.search).has('debugpanes')

  function handleSpeaker() {
    haptics.ttsStart()
    if (tts.state === 'loading' || tts.state === 'playing') {
      tts.stop()
    } else {
      tts.playSequence(entry.pl, entry.en)
    }
  }

  async function doEnrich() {
    setEnriching(true)
    setEnrichError(false)
    try {
      const [enrichRes, lemmaRes] = await Promise.all([
        fetch('/api/enrich-card', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lemma: entry.id, type: entry.type }),
        }),
        fetch('/api/lemmatize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: entry.pl }),
        }),
      ])
      if (!enrichRes.ok) throw new Error()
      const data = await enrichRes.json()
      let merged = mergeEnrichment(entry, data)
      if (lemmaRes.ok) {
        const lemmaData = await lemmaRes.json()
        if (lemmaData.canonicalEn) merged = { ...merged, en: lemmaData.canonicalEn }
      }
      onEnriched(merged)
    } catch {
      setEnrichError(true)
    } finally {
      setEnriching(false)
    }
  }

  useEffect(() => {
    if (!entry.enriched) doEnrich()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id])

  return (
    <div
      className={`fixed inset-0 z-[100] flex cursor-pointer items-center justify-center p-6 transition-opacity duration-300 ${overlayVisible ? 'opacity-100' : 'opacity-0'}`}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      onTouchEnd={e => {
        if (e.target !== e.currentTarget) return
        const now = Date.now()
        if (now - backdropLastTap.current < 300) { backdropLastTap.current = 0; onClose() }
        else backdropLastTap.current = now
      }}
    >
      {/* Full-screen dimming scrim — a PLAIN div, deliberately NOT a GlassPane.
          As a GlassPane it registered with the renderer, so the shader drew
          its glass rim-light at its edges (= the viewport edges), painting a
          glassy band around the whole screen — very visible once the
          bezel/fresnel were boosted. Only the card + buttons should carry
          glass; the scrim just dims.

          webgl: flat tint only. A full-screen backdrop-blur here would blur
          the shared glass canvas beneath it — including the modal's own card
          + button glass — flattening them; and the page behind is already
          display:none'd while open, so blur buys nothing. svg/css: keep the
          blur (per-element backdrop-filter, unaffected by this scrim). */}
      <div
        className={`pointer-events-none absolute inset-0 z-0 ${glassMode === 'webgl' ? 'bg-black/20' : 'bg-black/40 backdrop-blur-xl'}`}
      />
      <div className={`modal-content-wrapper relative z-10 flex w-full max-w-[400px] flex-col cursor-default${flipIn ? ' flip-in' : ''}`}>
          <GlassButton
            onClick={onClose}
            aria-label="Close"
            radius={24}
            pane="bg-white/10"
            className="self-start mb-3 h-12 w-12 border border-white/10 text-white/70 hover:text-white"
          >
            <span className="material-symbols-rounded text-[28px]">close</span>
          </GlassButton>
        <div className="relative w-full rounded-[40px] shadow-[0_16px_64px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(255,255,255,0.12)]">

          <div className="relative flex w-full flex-col rounded-[40px]">
            {/* Per-type colour blobs — sit behind GlassPane so the blur picks them up */}
            {!hideBlobsForDebug && <div className="absolute inset-0 overflow-hidden rounded-[40px]">
              {entry.type === 'verb' && (
                <>
                  <div className="absolute left-[-5%] top-[-10%] h-[55%] w-[65%] rounded-full bg-[#8C3FA0]/80 blur-3xl mix-blend-screen" />
                  <div className="absolute right-[-5%] top-[5%] h-[45%] w-[50%] rounded-full bg-[#2D2DA0]/80 blur-3xl mix-blend-screen" />
                  <div className="absolute bottom-[-10%] left-[10%] h-[55%] w-[65%] rounded-full bg-[#18AABF]/80 blur-3xl mix-blend-screen" />
                </>
              )}
              {entry.type === 'noun' && (
                <>
                  <div className="absolute left-[-5%] top-[-10%] h-[50%] w-[55%] rounded-full bg-[#6A2020]/80 blur-3xl mix-blend-screen" />
                  <div className="absolute left-[5%] top-[20%] h-[60%] w-[70%] rounded-full bg-[#C06820]/80 blur-3xl mix-blend-screen" />
                  <div className="absolute right-[-5%] top-[-10%] h-[45%] w-[40%] rounded-full bg-[#8A9220]/80 blur-3xl mix-blend-screen" />
                </>
              )}
              {entry.type === 'adjective' && (
                <>
                  <div className="absolute left-[-5%] top-[-10%] h-[50%] w-[55%] rounded-full bg-[#0F4020]/80 blur-3xl mix-blend-screen" />
                  <div className="absolute right-[-5%] top-[10%] h-[55%] w-[55%] rounded-full bg-[#1A8A30]/80 blur-3xl mix-blend-screen" />
                  <div className="absolute bottom-[-10%] left-[-5%] h-[45%] w-[50%] rounded-full bg-[#0C4A30]/80 blur-3xl mix-blend-screen" />
                </>
              )}
            </div>}
            <GlassPane borderRadius={40} className="absolute inset-0 z-0 rounded-[40px] bg-white/[0.02]" />
            <div className="relative z-10 flex flex-col p-[32px]">

            {/* Top row: type tag + actions */}
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

              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <GlassButton
                    onClick={() => setConfirmDelete(false)}
                    radius={19}
                    pane="bg-white/5"
                    className="h-[38px] border border-white/10 px-4 font-instrument text-[13px] text-white/50 hover:text-white"
                  >
                    Cancel
                  </GlassButton>
                  <GlassButton
                    onClick={onDelete}
                    radius={19}
                    pane="bg-red-400/10"
                    contentClassName="flex w-full items-center justify-center gap-1.5"
                    className="h-[38px] border border-red-400/30 px-4 font-instrument text-[13px] text-red-400"
                  >
                    <span className="material-symbols-rounded text-[16px]">delete_forever</span>
                    Delete
                  </GlassButton>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={doEnrich}
                    disabled={enriching}
                    className={`relative flex h-[38px] w-[38px] items-center justify-center rounded-full border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] transition-all hover:scale-105 active:scale-95 disabled:pointer-events-none ${enrichError ? 'text-red-400/70' : 'text-white/50 hover:text-white'}`}
                  >
                    <GlassPane borderRadius={19} className="absolute inset-0 z-0 rounded-full bg-white/5" />
                    <span className={`material-symbols-rounded relative z-10 text-[20px]${enriching ? ' animate-spin' : ''}`}>
                      {enrichError ? 'error' : 'refresh'}
                    </span>
                  </button>
                  <button
                    onClick={() => { haptics.destructive(); setConfirmDelete(true) }}
                    className="relative flex h-[38px] w-[38px] items-center justify-center rounded-full border border-red-400/20 text-red-400/50 transition-all hover:scale-105 hover:text-red-400 active:scale-95"
                  >
                    <GlassPane borderRadius={19} className="absolute inset-0 z-0 rounded-full bg-red-400/5" />
                    <span className="material-symbols-rounded relative z-10 text-[20px]">delete</span>
                  </button>
                </div>
              )}
            </div>

            {/* Word + translation */}
            <div className="mb-8 flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <h1 className="font-instrument text-[42px] font-bold leading-none tracking-tight text-[#F8FAFC]">
                  {entry.pl}
                  {entry.type === 'noun' && (
                    <span className="ml-3 text-[24px] font-medium italic text-[#e879f9]">{entry.gender}</span>
                  )}
                </h1>
                <button
                  onClick={handleSpeaker}
                  disabled={false}
                  className={`relative flex h-[36px] w-[36px] flex-shrink-0 items-center justify-center rounded-full border border-white/10 transition-all hover:scale-105 active:scale-95 ${tts.state === 'error' ? 'text-red-400/70' : 'text-white/50 hover:text-white'}`}
                >
                  <GlassPane borderRadius={18} className="absolute inset-0 z-0 rounded-full bg-white/5" />
                  <span className={`material-symbols-rounded relative z-10 text-[20px]${tts.state === 'playing' ? ' animate-pulse' : ''}`}>
                    {tts.state === 'loading' ? 'progress_activity' : tts.state === 'error' ? 'error' : 'volume_up'}
                  </span>
                </button>
              </div>
              {entry.type === 'noun' && (
                <h3 className="mb-1 mt-1 font-instrument text-[20px] leading-none text-white/40">{entry.plAlt}</h3>
              )}
              <h2 className="mt-1 font-instrument text-[22px] font-medium text-[#B4A0FF]">{entry.en}</h2>
            </div>

            {/* Type-specific grammatical detail */}
            {entry.type === 'verb'      && <VerbSection entry={entry} />}
            {entry.type === 'noun'      && <NounSection entry={entry} />}
            {entry.type === 'adjective' && <AdjectiveSection entry={entry} />}
            {entry.type === 'unknown'   && <FallbackSection entry={entry} />}

            {/* Translation via DeepL */}
            <ExamplesSection word={entry.pl} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
