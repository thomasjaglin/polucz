import { useState, useEffect, useRef, type CSSProperties } from 'react'
import { llmFetch } from '../lib/llmApi'
import { readLlmError, llmErrorMessage, type LlmErrorCode } from '../lib/llmErrors'
import { tagGradients, tagImages } from '../data/gradients'
import {
  type VocabEntry, type VocabVerb, type VocabNoun, type VocabAdjective, type VocabUnknown,
  type VerbConjugations, type NounDeclensions, type AdjectiveDeclensions,
  typeLabel,
} from '../data/types'
import GlassPane from './GlassPane'
import QuizQuestionsSection from './QuizQuestionsSection'
import GlassButton from './GlassButton'
import MasteredBurst from './MasteredBurst'
import MasteredLightBands from './MasteredLightBands'
import { useTTS } from '../lib/useTTS'
import { llmHeaders } from '../lib/llmConfig'
import { haptics } from '../lib/haptics'
import { isAudioAvailable, AUDIO_NEEDS_PREPARING } from '../lib/audioAvailability'
import { getGlassMode } from '../lib/glassMode'
import { useBackClose } from '../hooks/useBackClose'
import { pushToast } from '../lib/toastStore'

function mergeEnrichment(entry: VocabEntry, data: Record<string, unknown>): VocabEntry {
  const definitions = Array.isArray(data.definitions) ? (data.definitions as string[]) : entry.definitions
  const base = { ...entry, enriched: true, definitions }
  if (base.type === 'verb') {
    const aspect = typeof data.aspect === 'string' && data.aspect ? data.aspect : base.left
    return { ...base, left: aspect, conjugations: data.conjugations as VerbConjugations, otherForm: data.otherForm as { label: string; word: string } }
  }
  if (base.type === 'noun') {
    return { ...base, declensions: data.declensions as NounDeclensions, plAlt: data.plAlt as string }
  }
  if (base.type === 'adjective') {
    return {
      ...base,
      declensions: data.declensions as AdjectiveDeclensions,
      comparative: typeof data.comparative === 'string' ? data.comparative : undefined,
      superlative: typeof data.superlative === 'string' ? data.superlative : undefined,
    }
  }
  if (base.type === 'unknown') {
    return { ...base, info: data.info as string }
  }
  return base
}

// Polish case abbreviations, keyed by the full case name that the API returns.
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

// Abbreviation → full-word expansions revealed on tap. Covers the case labels
// (reverse of CASE_ABBREV) plus the column headers (number, gender, virility).
const ABBREV_TIP: Record<string, string> = {
  ...Object.fromEntries(Object.entries(CASE_ABBREV).map(([full, abbr]) => [abbr, full])),
  'l. poj.': 'liczba pojedyncza',
  'l. mn.':  'liczba mnoga',
  'm.':      'rodzaj męski',
  'f.':      'rodzaj żeński',
  'n.':      'rodzaj nijaki',
  'm.os.':   'męskoosobowy',
  'nm.os.':  'niemęskoosobowy',
  'past m.': 'past — rodzaj męski',
  'past f.': 'past — rodzaj żeński',
}

// Person markers for the verb conjugation rows (present/past forms come back in
// this fixed order from the enrichment API).
const VERB_PERSONS = ['ja', 'ty', 'on', 'my', 'wy', 'oni']

// ─── Sub-sections ─────────────────────────────────────────────────────────────

type ColKind = 'label' | 'value'

// Small auto-dismissing tooltip shown above a tapped abbreviation, styled as a
// liquid-glass pane (same GlassPane-behind-content pattern as the header pills).
function TipBubble({ text }: { text: string }) {
  return (
    <div className="pointer-events-none absolute bottom-full left-0 z-30 mb-1.5 whitespace-nowrap rounded-[12px] border border-ink/15 px-3 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
      <GlassPane borderRadius={12} className="absolute inset-0 z-0 rounded-[12px] bg-surface/55" />
      <span className="relative z-10 font-instrument text-[12px] not-italic text-ink/90">{text}</span>
    </div>
  )
}

// One CSS grid where every row shares a single baseline: when a long form wraps,
// the whole row grows together, so case/person labels never drift out of
// alignment (the failure mode of the old side-by-side flex stacks). Alternating
// rows get a faint band so the eye can track across on a narrow screen.
function ParadigmGrid({
  colTemplate, headers, kinds, rows, size = 15, tips, mastered = false,
}: {
  colTemplate: string
  headers: string[]
  kinds: ColKind[]
  rows: string[][]
  size?: number
  // Optional abbreviation → full-word map; label cells whose text has an entry
  // become tappable and reveal the full word in a tooltip.
  tips?: Record<string, string>
  // On mastered cards the text is full white and the zebra rows more opaque, for
  // legibility over the colourful holo background.
  mastered?: boolean
}) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  // Auto-dismiss the tooltip so there's no outside-tap handling to manage.
  useEffect(() => {
    if (openKey === null) return
    const t = setTimeout(() => setOpenKey(null), 2200)
    return () => clearTimeout(t)
  }, [openKey])

  return (
    <div className="grid" style={{ gridTemplateColumns: colTemplate }}>
      {headers.map((h, c) => {
        const tip = tips?.[h]
        const key = `h-${c}`
        const open = openKey === key
        return (
          <div
            key={key}
            onClick={tip ? () => { haptics.tap(); setOpenKey(open ? null : key) } : undefined}
            className={[
              `relative px-2 pb-2.5 font-instrument text-[12px] leading-tight ${mastered ? 'text-holo-meta' : 'text-ink/40'}`,
              tip ? 'cursor-pointer select-none' : '',
            ].join(' ')}
          >
            {h}
            {tip && open && <TipBubble text={tip} />}
          </div>
        )
      })}
      {rows.map((row, r) =>
        row.map((cell, c) => {
          const zebra = r % 2 === 1
          const isLabel = kinds[c] === 'label'
          const tip = isLabel ? tips?.[cell] : undefined
          const key = `${r}-${c}`
          const open = openKey === key
          return (
            <div
              key={`c-${key}`}
              // `min-w-0` removes the grid item's default min-content floor so the
              // cell can shrink below its longest word; paired with the value
              // tracks' `minmax(0, …)` this lets `break-words`/hyphenation wrap a
              // long form instead of forcing the table past the card edge.
              lang={isLabel ? undefined : 'pl'}
              onClick={tip ? () => { haptics.tap(); setOpenKey(open ? null : key) } : undefined}
              className={[
                'relative min-w-0 py-1.5 break-words hyphens-auto font-instrument leading-tight',
                // Tighten the gap between the label column and the values by
                // trimming the label cell's right padding.
                isLabel
                  ? `pl-2 pr-0.5 ${mastered ? 'text-holo-meta' : 'text-ink/45'}`
                  : `px-2 italic ${mastered ? 'text-holo-meta' : 'text-ink/85'}`,
                tip ? 'cursor-pointer select-none' : '',
                zebra ? (mastered ? 'bg-ink/[0.1]' : 'bg-ink/[0.04]') : '',
                zebra && c === 0 ? 'rounded-l-[8px]' : '',
                zebra && c === row.length - 1 ? 'rounded-r-[8px]' : '',
              ].join(' ')}
              style={{ fontSize: `${size}px` }}
            >
              {cell}
              {tip && open && <TipBubble text={tip} />}
            </div>
          )
        })
      )}
    </div>
  )
}

function EnrichingSkeleton() {
  return (
    <div className="mb-8 flex flex-col items-center gap-3 py-6 text-ink/30">
      <span className="material-symbols-rounded animate-spin text-[28px]">progress_activity</span>
      <span className="font-instrument text-[14px]">Loading grammar…</span>
    </div>
  )
}

function VerbSection({ entry, mastered }: { entry: VocabVerb; mastered: boolean }) {
  if (!entry.conjugations) return <EnrichingSkeleton />
  const { present, past, past2 } = entry.conjugations
  const rows = VERB_PERSONS.map((p, i) => [p, present[i] ?? '', past[i] ?? '', past2[i] ?? ''])
  return (
    <>
      <div className="mb-4 flex w-full flex-col">
        <ParadigmGrid
          colTemplate="auto minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)"
          headers={['', 'present', 'past m.', 'past f.']}
          kinds={['label', 'value', 'value', 'value']}
          rows={rows}
          tips={ABBREV_TIP}
          mastered={mastered}
        />
      </div>

      <div className="my-4 h-[1px] w-full bg-ink/10" />

      {entry.otherForm && (
        <div className="mb-2 flex items-center gap-4">
          <span className={`font-instrument text-[15px] ${mastered ? 'text-holo-meta' : 'text-ink/40'}`}>{entry.otherForm.label}</span>
          <span className={`font-instrument text-[18px] italic text-accent ${mastered ? 'holo-outline' : ''}`}>{entry.otherForm.word}</span>
        </div>
      )}
    </>
  )
}

function NounSection({ entry, mastered }: { entry: VocabNoun; mastered: boolean }) {
  if (!entry.declensions) return <EnrichingSkeleton />
  const { cases, singular, plural } = entry.declensions
  const rows = cases.map((c, i) => [abbrev(c), singular[i] ?? '', plural[i] ?? ''])
  return (
    <div className="mb-8 flex w-full flex-col">
      <ParadigmGrid
        colTemplate="auto minmax(0,1fr) minmax(0,1fr)"
        headers={['', 'l. poj.', 'l. mn.']}
        kinds={['label', 'value', 'value']}
        rows={rows}
        tips={ABBREV_TIP}
        mastered={mastered}
      />
    </div>
  )
}

// A single degree-of-comparison row (label + form) for the gradation block.
function GradeRow({ label, form, mastered }: { label: string; form: string; mastered: boolean }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className={`w-[76px] shrink-0 font-instrument text-[13px] ${mastered ? 'text-holo-meta' : 'text-ink/40'}`}>{label}</span>
      <span className={`font-instrument text-[16px] text-accent ${mastered ? 'holo-outline' : ''}`}>{form}</span>
    </div>
  )
}

function AdjectiveSection({ entry, mastered }: { entry: VocabAdjective; mastered: boolean }) {
  if (!entry.declensions) return <EnrichingSkeleton />
  const { cases, masculine, feminine, neuter, pluralMasc, pluralNonMasc } = entry.declensions
  const sgRows = cases.map((c, i) => [abbrev(c), masculine[i] ?? '', feminine[i] ?? '', neuter[i] ?? ''])
  const plRows = cases.map((c, i) => [abbrev(c), pluralMasc[i] ?? '', pluralNonMasc[i] ?? ''])
  // Non-gradable adjectives come back with empty comparative/superlative — skip
  // the block entirely in that case.
  const gradable = !!(entry.comparative || entry.superlative)
  return (
    <div className="mb-4 flex w-full flex-col gap-4">
      {/* Gradation: positive (the lemma), comparative, superlative. */}
      {gradable && (
        <>
          <div className="flex flex-col">
            <span className={`mb-3 font-instrument text-[12px] uppercase tracking-wider ${mastered ? 'text-holo-meta' : 'text-ink/40'}`}>stopniowanie</span>
            <div className="flex flex-col gap-2">
              <GradeRow label="równy" form={entry.pl} mastered={mastered} />
              {entry.comparative && <GradeRow label="wyższy" form={entry.comparative} mastered={mastered} />}
              {entry.superlative && <GradeRow label="najwyższy" form={entry.superlative} mastered={mastered} />}
            </div>
          </div>
          <div className="h-[1px] w-full bg-ink/10" />
        </>
      )}

      {/* Singular: cases, m., f., n. */}
      <div className="flex flex-col">
        <span className={`mb-3 font-instrument text-[12px] uppercase tracking-wider ${mastered ? 'text-holo-meta' : 'text-ink/40'}`}>l. pojedyncza</span>
        <ParadigmGrid
          colTemplate="auto minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)"
          headers={['', 'm.', 'f.', 'n.']}
          kinds={['label', 'value', 'value', 'value']}
          rows={sgRows}
          size={13}
          tips={ABBREV_TIP}
          mastered={mastered}
        />
      </div>

      <div className="h-[1px] w-full bg-ink/10" />

      {/* Plural: cases, m.os. (virile), nm.os. (non-virile) */}
      <div className="flex flex-col">
        <span className={`mb-3 font-instrument text-[12px] uppercase tracking-wider ${mastered ? 'text-holo-meta' : 'text-ink/40'}`}>l. mnoga</span>
        <ParadigmGrid
          colTemplate="auto minmax(0,1fr) minmax(0,1fr)"
          headers={['', 'm.os.', 'nm.os.']}
          kinds={['label', 'value', 'value']}
          rows={plRows}
          size={13}
          tips={ABBREV_TIP}
          mastered={mastered}
        />
      </div>
    </div>
  )
}

function FallbackSection({ entry }: { entry: VocabUnknown }) {
  return (
    <div className="flex flex-col gap-4 rounded-[24px] border border-ink/5 bg-ink/5 p-5">
      <p className="font-instrument text-[16px] text-ink/80">
        {entry.info ?? 'No additional info available.'}
      </p>
    </div>
  )
}

interface Example { pl: string; en: string }
type ExampleSource = 'corpus' | 'generated' | null
interface ExampleData { examples: Example[]; source: ExampleSource }

// Examples are stable per word, so cache what we fetch and reuse it instead of
// re-hitting /api/examples every time the modal reopens. In-memory for the
// session, mirrored to localStorage so it also survives reloads. Best-effort:
// any storage failure just falls back to a network fetch.
const exampleMem = new Map<string, ExampleData>()
const exampleKey = (w: string) => `polucz_examples:${w.toLowerCase()}`

function getCachedExamples(word: string): ExampleData | null {
  const mem = exampleMem.get(word)
  if (mem) return mem
  try {
    const raw = localStorage.getItem(exampleKey(word))
    if (raw) {
      const data = JSON.parse(raw) as ExampleData
      exampleMem.set(word, data)
      return data
    }
  } catch { /* ignore */ }
  return null
}

function putCachedExamples(word: string, data: ExampleData) {
  exampleMem.set(word, data)
  try { localStorage.setItem(exampleKey(word), JSON.stringify(data)) } catch { /* ignore */ }
}

function ExamplesSection({ word, mastered }: { word: string; mastered: boolean }) {
  const [loading, setLoading] = useState(false)
  // Seed from cache so a previously-fetched card shows its examples instantly
  // (no button, no refetch).
  const [examples, setExamples] = useState<Example[] | null>(() => getCachedExamples(word)?.examples ?? null)
  const [source, setSource] = useState<ExampleSource>(() => getCachedExamples(word)?.source ?? null)
  const [error, setError] = useState(false)
  // Why it failed, so a missing key doesn't read as a dead endpoint.
  const [errorCode, setErrorCode] = useState<LlmErrorCode>('upstream')

  // `exclude` non-empty = a refresh: ask the API for sentences other than the
  // ones already shown. On failure we keep the current examples and just toast,
  // rather than wiping them.
  async function fetchExamples(exclude: string[] = []) {
    const isRefresh = exclude.length > 0
    setLoading(true)
    if (!isRefresh) setError(false)
    try {
      const res = await llmFetch('/api/examples', { word, exclude })
      const data = await res.json()
      if (res.ok && Array.isArray(data.examples) && data.examples.length > 0) {
        setExamples(data.examples)
        setSource(data.source ?? null)
        putCachedExamples(word, { examples: data.examples, source: data.source ?? null })
      } else if (isRefresh) {
        pushToast(res.ok ? 'No different examples found' : llmErrorMessage(await readLlmError(res)), res.ok ? 'info' : 'error')
      } else {
        if (!res.ok) setErrorCode(await readLlmError(res))
        setError(true)
      }
    } catch {
      if (isRefresh) pushToast('Could not refresh examples', 'error')
      else setError(true)
    } finally {
      setLoading(false)
    }
  }

  function handleFind() {
    if (loading || examples) return
    fetchExamples()
  }

  function handleRefresh() {
    if (loading) return
    fetchExamples(examples?.map(e => e.pl) ?? [])
  }

  if (examples) {
    return (
      <div className="mt-4 flex flex-col gap-4 border-t border-ink/10 pt-4">
        <div className="flex items-center justify-between">
          <span className={`font-instrument text-[14px] ${mastered ? 'text-holo-meta' : 'text-ink/20'}`}>
            Examples · {source === 'corpus' ? 'real usage (Tatoeba)' : 'AI-generated'}
          </span>
          <button
            onClick={handleRefresh}
            disabled={loading}
            aria-label="Get different examples"
            className="relative flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full border border-ink/10 text-ink/40 transition-all hover:scale-105 hover:text-ink/80 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
          >
            <GlassPane borderRadius={15} className="absolute inset-0 z-0 rounded-full bg-ink/5" />
            <span className={`material-symbols-rounded relative z-10 text-[16px]${loading ? ' animate-spin' : ''}`}>refresh</span>
          </button>
        </div>
        <div className="flex flex-col gap-4">
          {examples.map((ex, i) => (
            <div key={i} className="flex flex-col gap-1">
              <p className="font-instrument text-[17px] leading-snug text-ink/90">{ex.pl}</p>
              {/* Smallest purple copy: keep the soft inherited card-mastered
                  text-shadow (same as the small white grammar text) rather than
                  the heavier crisp drop-shadow outline used on the larger words. */}
              <p className="font-instrument text-[14px] italic leading-snug text-accent/70">{ex.en}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <GlassButton
      onClick={handleFind}
      disabled={loading}
      radius={24}
      pane="bg-ink/5"
      className="mt-4 w-full py-4 font-instrument text-[16px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
    >
      {loading ? (
        <span className="material-symbols-rounded animate-spin text-ink/40">progress_activity</span>
      ) : error ? (
        <>
          <span className="material-symbols-rounded text-[16px] text-red-400/70">error</span>
          <span className="text-ink/40">
            {errorCode === 'not_configured' ? llmErrorMessage(errorCode) : 'Unavailable — tap to retry'}
          </span>
        </>
      ) : (
        <span className="text-ink/40">Fetch examples</span>
      )}
    </GlassButton>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface Props {
  entry: VocabEntry
  mastered?: boolean
  flipIn: boolean
  overlayVisible: boolean
  onClose: () => void
  onEnriched: (updated: VocabEntry) => void
  onAudioReady: (id: string) => void
  onDelete: () => void
}

export default function WordDetailModal({ entry, mastered = false, flipIn, overlayVisible, onClose, onEnriched, onAudioReady, onDelete }: Props) {
  const [enriching, setEnriching] = useState(false)
  const [enrichError, setEnrichError] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const tts = useTTS()
  const backdropLastTap = useRef(0)
  const glassMode = getGlassMode()

  // Android back cancels the delete confirmation first; a second back then
  // closes the whole modal (which App registers as its own back layer).
  useBackClose(confirmDelete, () => setConfirmDelete(false))

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
      // Enrichment only fills the grammar tables. It deliberately does NOT
      // re-lemmatize/overwrite `en`: that was replacing the creation-time
      // translation with a fresh (and, since lemmatize is a stochastic LLM,
      // often different) canonicalEn. The word's translation is set once at
      // card creation and left alone.
      const enrichRes = await llmFetch('/api/enrich-card', { lemma: entry.id, type: entry.type })
      if (!enrichRes.ok) throw new Error()
      const data = await enrichRes.json()
      onEnriched(mergeEnrichment(entry, data))
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

  // Cache this card's TTS audio in the background while the modal is open (a
  // small, naturally-throttled batch), and mark it audio-ready on success. This
  // is how the vocabulary gets its audio without a burst that trips the rate
  // limit — the audio player then only uses cards that are already cached.
  useEffect(() => {
    // Natively prefetch is a no-op that returns true, so this only wrote a flag
    // meaning "a modal was opened once". Skip it rather than record that.
    if (!AUDIO_NEEDS_PREPARING || entry.audioReady) return
    let cancelled = false
    tts.prefetch(entry.pl, entry.en).then(ok => {
      if (ok && !cancelled) onAudioReady(entry.id)
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id])

  return (
    <div
      className={`no-scrollbar fixed inset-0 z-[100] flex cursor-pointer items-start justify-center overflow-y-auto p-6 transition-opacity duration-300 ${overlayVisible ? 'opacity-100' : 'opacity-0'}`}
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
        className={`pointer-events-none fixed inset-0 z-0 ${glassMode === 'webgl' ? '' : 'backdrop-blur-xl'}`}
        style={{ background: glassMode === 'webgl' ? 'var(--veil-modal-webgl)' : 'var(--veil-modal)' }}
      />
      <div className={`modal-content-wrapper relative z-10 flex w-full max-w-[400px] flex-col cursor-default${flipIn ? ' flip-in' : ''}`}>
          <GlassButton
            onClick={onClose}
            aria-label="Close"
            radius={24}
            pane="bg-ink/10"
            className="self-start mb-3 h-12 w-12 border border-ink/10 text-ink/70 hover:text-ink"
          >
            <span className="material-symbols-rounded text-[28px]">close</span>
          </GlassButton>
        <div className={`relative w-full rounded-[36px] ${mastered ? 'shadow-[0_16px_64px_rgba(0,0,0,0.6),inset_0_0_30px_rgba(255,200,100,0.15),inset_0_0_0_1px_rgba(255,220,150,0.3)]' : 'shadow-[0_16px_64px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(255,255,255,0.12)]'}`}>

          {/* Persistent golden light rays behind the card (spin in on open, keep
              turning while open). Rendered before the card so it sits behind it. */}
          {mastered && <MasteredLightBands />}

          {/* One-shot star burst + light bloom when a mastered card opens. */}
          {mastered && <MasteredBurst />}

          <div
            className={`relative flex w-full flex-col rounded-[36px] ${mastered ? 'card-mastered holo-full' : ''}`}
            data-mastered-type={mastered ? entry.type : undefined}
            style={mastered ? ({ '--tag-img': `url(${tagImages[entry.type] ?? tagImages.unknown})` } as CSSProperties) : undefined}
          >
            {/* Per-type colour blobs — sit behind GlassPane so the blur picks them up */}
            <div className="absolute inset-0 overflow-hidden rounded-[36px]">
              {/* Mastered: a solid per-type gradient base so the holo always has a
                  colourful "illustration" to sit on (not black). */}
              {mastered && (
                <div className="mastered-base absolute inset-0" data-mastered-type={entry.type} />
              )}
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
            </div>
            <GlassPane borderRadius={36} className="absolute inset-0 z-0 rounded-[36px] bg-ink/[0.02]" />
            {/* Holographic shimmer for mastered words — sits above the glass
                (z-0) and below the content (z-10). */}
            {mastered && <div className="cosmos-shine" aria-hidden="true" />}
            {mastered && <div className="holo-edge" aria-hidden="true" />}
            <div className="relative z-10 flex flex-col p-8">

            {/* Top row: type tag + actions */}
            <div className="mb-8 flex w-full items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`relative flex items-center justify-center overflow-hidden rounded-[124px] border border-ink/20 px-4 py-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)] ${mastered ? 'tag-holo bg-cover bg-center' : 'bg-ink/10'}`}
                  data-mastered-type={mastered ? entry.type : undefined}
                  style={mastered ? ({ '--tag-img': `url(${tagImages[entry.type] ?? tagImages.unknown})` } as CSSProperties) : undefined}
                >
                  {!mastered && (
                    <div
                      className="absolute inset-0 z-0 flex items-center justify-center opacity-70 mix-blend-screen"
                      dangerouslySetInnerHTML={{ __html: tagGradients[entry.type] ?? tagGradients['unknown'] }}
                    />
                  )}
                  <span className="relative z-10 font-instrument text-[12px] font-medium capitalize text-ink">
                    {typeLabel(entry.type)}
                  </span>
                </div>
                {mastered && (
                  <span className="holo-icon shrink-0 text-[16px] leading-none">★</span>
                )}
                {entry.enriched && (
                  <span
                    aria-label={AUDIO_NEEDS_PREPARING && isAudioAvailable(entry.audioReady) ? 'Fully prepared (details + audio)' : 'Details populated'}
                    // Same gating as the star above. Literal colour rather than
                    // the accent token because this modal is still dark-only.
                    className={`material-symbols-rounded shrink-0 text-[18px] leading-none ${mastered ? 'holo-icon' : 'text-accent/70'}`}
                  >
                    {AUDIO_NEEDS_PREPARING && isAudioAvailable(entry.audioReady) ? 'done_all' : 'done'}
                  </span>
                )}
              </div>

              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <GlassButton
                    onClick={() => setConfirmDelete(false)}
                    radius={20}
                    pane="bg-ink/5"
                    className="h-[38px] border border-ink/10 px-4 font-instrument text-[13px] text-ink/50 hover:text-ink"
                  >
                    Cancel
                  </GlassButton>
                  <GlassButton
                    onClick={onDelete}
                    radius={20}
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
                    className={`relative flex h-[38px] w-[38px] items-center justify-center rounded-full border border-ink/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] transition-all hover:scale-105 active:scale-95 disabled:pointer-events-none ${enrichError ? 'text-red-400/70' : 'text-ink/50 hover:text-ink'}`}
                  >
                    <GlassPane borderRadius={20} className="absolute inset-0 z-0 rounded-full bg-ink/5" />
                    <span className={`material-symbols-rounded relative z-10 text-[20px]${enriching ? ' animate-spin' : ''}`}>
                      {enrichError ? 'error' : 'refresh'}
                    </span>
                  </button>
                  <button
                    onClick={() => { haptics.destructive(); setConfirmDelete(true) }}
                    className="relative flex h-[38px] w-[38px] items-center justify-center rounded-full border border-red-400/20 text-red-400/50 transition-all hover:scale-105 hover:text-red-400 active:scale-95"
                  >
                    <GlassPane borderRadius={20} className="absolute inset-0 z-0 rounded-full bg-red-400/5" />
                    <span className="material-symbols-rounded relative z-10 text-[20px]">delete</span>
                  </button>
                </div>
              )}
            </div>

            {/* Word + translation */}
            <div className="mb-8 flex flex-col gap-1">
              <div className="flex min-w-0 items-start gap-3">
                <h1 lang="pl" className="hyphens-auto break-words font-instrument text-[42px] font-bold leading-none tracking-tight text-ink">
                  {mastered ? <span className="holo-text">{entry.pl}</span> : entry.pl}
                  {entry.type === 'noun' && (
                    <span className="ml-3 text-[24px] font-medium italic" style={{ color: 'var(--aspect)' }}>{entry.gender}</span>
                  )}
                  {entry.type === 'verb' && entry.left && (
                    <span className="ml-3 text-[24px] font-medium italic" style={{ color: 'var(--aspect)' }}>{entry.left}</span>
                  )}
                </h1>
                <button
                  onClick={handleSpeaker}
                  disabled={false}
                  className={`relative mt-[3px] flex h-[36px] w-[36px] flex-shrink-0 items-center justify-center rounded-full border border-ink/10 transition-all hover:scale-105 active:scale-95 ${tts.state === 'error' ? 'text-red-400/70' : 'text-ink/50 hover:text-ink'}`}
                >
                  <GlassPane borderRadius={20} className="absolute inset-0 z-0 rounded-full bg-ink/5" />
                  <span className={`material-symbols-rounded relative z-10 text-[20px]${tts.state === 'playing' ? ' animate-pulse' : ''}`}>
                    {tts.state === 'loading' ? 'progress_activity' : tts.state === 'error' ? 'error' : 'volume_up'}
                  </span>
                </button>
              </div>
              {entry.type === 'noun' && (
                <h3 className={`mb-1 mt-1 font-instrument text-[20px] leading-none ${mastered ? 'text-holo-meta' : 'text-ink/40'}`}>{entry.plAlt}</h3>
              )}
              <h2 className={`mt-1 font-instrument text-[22px] font-medium text-accent ${mastered ? 'holo-outline' : ''}`}>{entry.en}</h2>
              {/* Secondary senses filled during enrichment */}
              {entry.definitions && entry.definitions.length > 0 && (
                <p className="font-instrument text-[14px] leading-snug text-ink/45">
                  {entry.definitions.join(' · ')}
                </p>
              )}
            </div>

            {/* Type-specific grammatical detail */}
            {entry.type === 'verb'      && <VerbSection entry={entry} mastered={mastered} />}
            {entry.type === 'noun'      && <NounSection entry={entry} mastered={mastered} />}
            {entry.type === 'adjective' && <AdjectiveSection entry={entry} mastered={mastered} />}
            {entry.type === 'unknown'   && <FallbackSection entry={entry} />}

            {/* Translation via DeepL */}
            <ExamplesSection word={entry.pl} mastered={mastered} />
            <QuizQuestionsSection entry={entry} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
