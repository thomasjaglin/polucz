import { useState, useRef, useEffect, type CSSProperties } from 'react'
import { llmFetch } from '../lib/llmApi'
import { readLlmError, llmErrorMessage, type LlmErrorCode } from '../lib/llmErrors'
import { motion, AnimatePresence, useMotionValue, useTransform, useMotionValueEvent, animate } from 'framer-motion'
import GlassPane from './GlassPane'
import GlassButton from './GlassButton'
import { tagGradients } from '../data/gradients'
import { findByLemma, getCards, saveCard } from '../lib/storage'
import { llmHeaders, getDeepLKey } from '../lib/llmConfig'
import { setAnchor } from './tour/anchors'
import { TOUR_SENTENCE, TOUR_TRANSLATION, TOUR_LEMMAS, FAKE_LATENCY, fakeWait } from '../data/tourFixture'

/** Set once the suggested first sentence has been offered. */
const PREFILL_KEY = 'polucz_translate_prefilled'
import { type VocabEntry, type WordType, type PageId, typeLabel } from '../data/types'
import { generateMaskGlassCanvas, GLASS_OVERSCAN } from '../lib/generateGlassMap'
import { pokeRenderer, setBgBlobTop, registerMaskPane } from '../webgl/glassStore'
import { haptics } from '../lib/haptics'
import { getGlassMode } from '../lib/glassMode'
import translateBlobUrl from '../assets/translate-gradient.svg'

type Direction = 'pl-en' | 'en-pl'

// Figma 114-9301 / 114-13593: the screen splits at ~51.4% with Polish fixed
// on top and English fixed below. A huge blurred gradient circle (114-13508)
// backs whichever side is the SOURCE (where the input lives); swapping
// languages sends the circle to the other half. The result card appears on
// the opposite (dark) side.
const BOUNDARY = 51.4 // vh — circle edge & swap button center
const CIRCLE_H = 73.4 // vh (673/917)
const CIRCLE_W = 135  // vw (557/412)
const EDGE_OFFSET = 0 // vh — border ring aligned flush with the gradient circle clip

const SPRING = { type: 'spring', stiffness: 220, damping: 28 } as const

// Result-under-circle mask. The WebGL glass is occluded by the circle's ellipse
// (see GlassPane clipEllipseRef), so the DOM text must vanish along the same
// curve to match. We raise the result section up into the circle by CLIP_OVER
// so content can render above the boundary (where the circle's curve sits), and
// apply a static radial-ellipse mask that hides whatever falls inside the
// circle. The section box is fixed (only its content scrolls) and the circle is
// fixed per swap state, so the mask is a constant vw/vh gradient — no listener.
const CLIP_OVER = 12 // vh the result section extends past the boundary into the circle
const CIRCLE_RX = CIRCLE_W / 2 // vw
const CIRCLE_RY = CIRCLE_H / 2 // vh
const CIRCLE_CY_TOP = BOUNDARY - CIRCLE_H / 2 // vh — circle centre when source is on top

// Radial ellipse mask (transparent inside the circle → hidden, opaque outside →
// shown). cyInSection = circle centre minus the masked section's own top (vh).
function circleMask(cyInSection: number): CSSProperties {
  const g = `radial-gradient(${CIRCLE_RX}vw ${CIRCLE_RY}vh at 50% ${cyInSection}vh, transparent 99.5%, #000 100%)`
  return { WebkitMaskImage: g, maskImage: g }
}

// Vertical position (topFrac, fraction of viewport height) of the procedural
// gradient blob in the WebGL background, for the two swap states. Derived from
// the old DOM blob's animated top (BOUNDARY-CIRCLE_H / 100-BOUNDARY) plus the
// SVG's -5%·CIRCLE_H internal offset. GlassCanvas reads the live value via the
// glassStore and re-bakes the background as it slides.
// The ring's top position for each swap state (fraction of viewport height).
// The procedural blob, its elliptical clip, and the glass disc all share this
// reference so they stay aligned as the circle slides.
const BLOB_TOP_SRC = (BOUNDARY - CIRCLE_H) / 100 // source on top
const BLOB_TOP_DST = (100 - BOUNDARY) / 100      // source on bottom

// ── DOM blob (css/svg mode) ──────────────────────────────────────────────
// Without a canvas there is no procedural blob, and the translate page loses
// all of its colour. These mirror the `translate` layer in backgroundData.ts
// one-for-one — same box, same clip — so the DOM and shader blobs land in the
// same place and the two renderers stay comparable.
const BLOB_W_VW = 201.69    // backgroundData widthFracVw 2.0169
const BLOB_H_VH = 85.14     // backgroundData heightFracVh 0.8514
const BLOB_LEFT_VW = -32.755 // backgroundData leftFrac -0.32755
// Opacity is theme-driven (--blob-opacity in index.css); the shader path
// still uses backgroundData's own 0.6.

// The layer slides by transform rather than `top`, so the SVG's internal
// Gaussian blur rasterises once and the swap stays a pure compositor move.
const BLOB_TRAVEL_VH = (BLOB_TOP_DST - BLOB_TOP_SRC) * 100

// The ring ellipse (CIRCLE_W × CIRCLE_H, centered, top edge on the layer's top)
// expressed as percentages of the blob's own box. Because the ellipse and the
// layer share that top edge, this is constant — it rides along with the
// transform and never needs recomputing on swap. Opaque inside, transparent
// out: the inverse of circleMask() above, which hides the result text along the
// same curve.
const BLOB_MASK = `radial-gradient(${(CIRCLE_W / 2) / BLOB_W_VW * 100}% ${(CIRCLE_H / 2) / BLOB_H_VH * 100}% at ${(50 - BLOB_LEFT_VW) / BLOB_W_VW * 100}% ${(CIRCLE_H / 2) / BLOB_H_VH * 100}%, #000 99.5%, transparent 100%)`

// Elliptical glass mask for the circle: a filled ellipse matching its
// rounded-[50%] box, so the circle reads as a glass disc (refraction + rim
// following the true elliptical silhouette) over the procedural blob. Built
// once per viewport size (the box is vw/vh); its live on-screen position is
// read each frame by GlassCanvas, so the swap slide needs no rebuild.
function drawCircleMask(w: number, h: number) {
  return (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

const circleMaskCache = new Map<string, { canvas: HTMLCanvasElement; scale: number }>()

function buildCircleMask(w: number, h: number): { canvas: HTMLCanvasElement; scale: number } {
  const key = `${w}x${h}`
  let entry = circleMaskCache.get(key)
  if (!entry) {
    const { canvas, scale } = generateMaskGlassCanvas(w, h, drawCircleMask(w, h), {
      blurRadius: 5, scale: 26, highlight: 0.5, shade: 0.15, coverageAlpha: true,
    })
    entry = { canvas, scale }
    circleMaskCache.set(key, entry)
  }
  return entry
}

function buildEntry(lemma: string, canonicalEn: string, type: WordType, gender: string): VocabEntry {
  if (type === 'verb') {
    return { id: lemma, enriched: false, pl: lemma, en: canonicalEn, left: '', right: '', tags: ['verb'], type: 'verb', conjugations: null, otherForm: null }
  }
  if (type === 'noun') {
    return { id: lemma, enriched: false, pl: lemma, en: canonicalEn, left: gender, right: '', tags: ['noun'], type: 'noun', gender, plAlt: '', declensions: null }
  }
  if (type === 'adjective') {
    return { id: lemma, enriched: false, pl: lemma, en: canonicalEn, left: 'adj', right: '', tags: ['adjective'], type: 'adjective', declensions: null }
  }
  return { id: lemma, enriched: false, pl: lemma, en: canonicalEn, left: '', right: '', tags: ['unknown'], type: 'unknown' }
}

function buildMiningEntry(word: AnalyzedWord, plSentence: string, enSentence: string): VocabEntry {
  const sourceContext = { sentence: plSentence, translation: enSentence, addedFrom: 'sentence-mining' as const }
  if (word.type === 'verb') {
    return { id: word.lemma, enriched: false, pl: word.lemma, en: word.english, left: '', right: '', tags: ['verb'], type: 'verb', conjugations: null, otherForm: null, sourceContext }
  }
  if (word.type === 'noun') {
    return { id: word.lemma, enriched: false, pl: word.lemma, en: word.english, left: word.gender, right: '', tags: ['noun'], type: 'noun', gender: word.gender, plAlt: '', declensions: null, sourceContext }
  }
  if (word.type === 'adjective') {
    return { id: word.lemma, enriched: false, pl: word.lemma, en: word.english, left: 'adj', right: '', tags: ['adjective'], type: 'adjective', declensions: null, sourceContext }
  }
  return { id: word.lemma, enriched: false, pl: word.lemma, en: word.english, left: '', right: '', tags: ['unknown'], type: 'unknown', sourceContext }
}

interface AnalyzedWord {
  lemma: string
  type: 'noun' | 'verb' | 'adjective' | 'adverb' | 'unknown'
  english: string
  gender: string
}

interface Result {
  translation: string
  lemma: string
  type: WordType
  gender: string
  isSingleWord: boolean
  canonicalEn: string
  plSentence: string
  enSentence: string
}

interface Props {
  onAddCard: (entry: VocabEntry) => void
  /** Error states route here when the failure is a missing API key. */
  onChangePage: (id: PageId) => void
  /** True while the arrival tour is running: no calls, scripted answers. */
  tourActive?: boolean
  /** Tells the tour the user did the thing it was waiting for. */
  onTourEvent?: (e: 'translate-done' | 'words-added') => void
}

const isSingleWord = (text: string) => {
  const words = text.trim().split(/\s+/)
  return words.length === 1 || (words.length === 2 && words[1].toLowerCase() === 'się')
}

const TYPE_BADGE: Record<string, string> = {
  noun:      'text-[#FB923C] bg-[#FB923C]/10 border-[#FB923C]/25',
  verb:      'text-[#60A5FA] bg-[#60A5FA]/10 border-[#60A5FA]/25',
  adjective: 'text-[#34D399] bg-[#34D399]/10 border-[#34D399]/25',
  adverb:    'text-[#C084FC] bg-[#C084FC]/10 border-[#C084FC]/25',
  unknown:   'text-accent bg-accent/10 border-accent/25',
}

function WordRow({ word, isSaved, onAdd }: { word: AnalyzedWord; isSaved: boolean; onAdd: () => void }) {
  return (
    <div className="flex items-center gap-2 border-b border-ink/5 py-2.5 last:border-0">
      <span className={`shrink-0 rounded-full border px-2 py-0.5 font-instrument text-[10px] font-medium capitalize ${TYPE_BADGE[word.type] ?? TYPE_BADGE.unknown}`}>
        {word.type === 'adjective' ? 'adj' : typeLabel(word.type)}
      </span>
      <span className="min-w-0 truncate font-instrument text-[15px] font-medium text-ink/90">{word.lemma}</span>
      {word.gender && <span className="shrink-0 font-instrument text-[13px] italic " style={{ color: 'var(--aspect)' }}>{word.gender}</span>}
      <span className="shrink-0 ink-glyph">·</span>
      <span className="min-w-0 flex-1 truncate font-instrument text-[13px] ink-tertiary">{word.english}</span>
      {isSaved ? (
        <span className="shrink-0 whitespace-nowrap font-instrument text-[11px] ink-tertiary">✓ In vocabulary</span>
      ) : (
        <button
          onClick={onAdd}
          className="relative shrink-0 overflow-hidden whitespace-nowrap rounded-full border border-ink/20 px-3 py-1 font-instrument text-[11px] text-ink/60 transition-colors hover:text-ink"
        >
          <GlassPane borderRadius={999} className="absolute inset-0 z-0 rounded-full bg-ink/5" />
          <span className="relative z-10">+ Add card</span>
        </button>
      )}
    </div>
  )
}

export default function TranslatePage({ onAddCard, onChangePage, tourActive = false, onTourEvent }: Props) {
  // "Dzień dobry!" is waiting the first time this page is opened, tour or not —
  // so even someone who skipped everything finds a suggested sentence. Outside
  // the tour it is ordinary text: editable, clearable, and it does not come back
  // once they have made the page their own.
  const [input, setInput] = useState(() => {
    try {
      if (localStorage.getItem(PREFILL_KEY)) return ''
      localStorage.setItem(PREFILL_KEY, '1')
      return TOUR_SENTENCE
    } catch {
      return ''
    }
  })

  // A tour that starts after the page has already been used still needs its
  // sentence in the box; the step that follows translates exactly this.
  useEffect(() => {
    if (tourActive) setInput(TOUR_SENTENCE)
  }, [tourActive])
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  // Which failure it was, so the message can name the fix rather than blaming
  // the network for a missing key.
  const [errorCode, setErrorCode] = useState<LlmErrorCode>('upstream')
  const [result, setResult] = useState<Result | null>(null)
  const [added, setAdded] = useState(false)
  const [direction, setDirection] = useState<Direction>('pl-en')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [wordPhase, setWordPhase] = useState<'idle' | 'loading' | 'done'>('idle')
  const [words, setWords] = useState<AnalyzedWord[]>([])
  const [savedSet, setSavedSet] = useState<Set<string>>(() => new Set(getCards().map(c => c.pl.toLowerCase())))
  const translateIdRef = useRef(0)
  const circleRef = useRef<HTMLDivElement>(null)
  // Renderer is fixed for the page's lifetime (only a context-loss fallback
  // changes it, which remounts), so a plain read is enough.
  const isWebgl = getGlassMode() === 'webgl'

  // Register the circle as an elliptical glass mask pane so it reads as a glass
  // disc refracting the blob behind it. The map is size-only (rebuilt on
  // resize); GlassCanvas reads the element's live rect each frame, so the swap
  // slide needs no regeneration. Deferred off the first-open critical path.
  useEffect(() => {
    if (getGlassMode() !== 'webgl') return
    const el = circleRef.current
    if (!el) return
    let unregister: (() => void) | null = null
    let idleHandle: number | null = null
    let cancelled = false

    function register() {
      const w = Math.round(window.innerWidth * CIRCLE_W / 100)
      const h = Math.round(window.innerHeight * CIRCLE_H / 100)
      const { canvas, scale } = buildCircleMask(w, h)
      if (cancelled || !el) return
      unregister = registerMaskPane({ el, map: canvas, scale, overscan: GLASS_OVERSCAN })
    }

    const key = `${Math.round(window.innerWidth * CIRCLE_W / 100)}x${Math.round(window.innerHeight * CIRCLE_H / 100)}`
    if (circleMaskCache.has(key)) register()
    else if (window.requestIdleCallback) idleHandle = window.requestIdleCallback(() => { idleHandle = null; register() }, { timeout: 500 })
    else idleHandle = window.setTimeout(() => { idleHandle = null; register() }, 0)

    function onResize() { unregister?.(); unregister = null; register() }
    window.addEventListener('resize', onResize)
    return () => {
      cancelled = true
      window.removeEventListener('resize', onResize)
      if (idleHandle != null) { if (window.cancelIdleCallback) window.cancelIdleCallback(idleHandle); else clearTimeout(idleHandle) }
      unregister?.()
    }
  }, [])

  const x = useMotionValue(0)
  const addOpacity = useTransform(x, [0, 80], [0, 1])
  const clearOpacity = useTransform(x, [-80, 0], [1, 0])
  // Keep the WebGL glass tracking the result card during swipe so it doesn't ghost.
  useMotionValueEvent(x, 'change', pokeRenderer)

  const srcTop = direction === 'pl-en' // source = Polish (top) or English (bottom)

  // Drive the procedural gradient blob's vertical position in the WebGL
  // background. A MotionValue springs between the two swap positions with the
  // same feel as the DOM border ring, and pushes each frame into the glassStore
  // so GlassCanvas re-bakes the background as the blob slides.
  const blobTop = useMotionValue(BLOB_TOP_SRC)
  useMotionValueEvent(blobTop, 'change', setBgBlobTop)
  useEffect(() => {
    // Force the store to the mounted position (module-level store may be stale
    // from a previous visit; direction always resets to pl-en on remount).
    setBgBlobTop(srcTop ? BLOB_TOP_SRC : BLOB_TOP_DST)
    const controls = animate(blobTop, srcTop ? BLOB_TOP_SRC : BLOB_TOP_DST, SPRING)
    return () => controls.stop()
  }, [srcTop]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleTranslate() {
    const text = input.trim()
    if (!text || phase === 'loading') return
    setPhase('loading')
    setResult(null)
    setAdded(false)
    setWords([])
    setWordPhase('idle')
    x.set(0)

    const myId = ++translateIdRef.current

    // The tour never calls anything. It walks the same states in the same order
    // with the same shapes, so what the user learns here is what the app really
    // does — only the answer is preloaded and the waiting is scripted.
    if (tourActive) {
      await fakeWait(FAKE_LATENCY.translate)
      if (translateIdRef.current !== myId) return
      setResult({
        translation: TOUR_TRANSLATION,
        lemma: '', type: 'unknown', gender: '',
        isSingleWord: false, canonicalEn: '',
        plSentence: TOUR_SENTENCE, enSentence: TOUR_TRANSLATION,
      })
      setPhase('done')
      setWordPhase('loading')
      await fakeWait(FAKE_LATENCY.lemmatise)
      if (translateIdRef.current !== myId) return
      setWords(TOUR_LEMMAS.map(l => ({ lemma: l.lemma, type: l.type, english: l.en, gender: l.note })))
      setWordPhase('done')
      onTourEvent?.('translate-done')
      return
    }

    try {
      const single = direction === 'pl-en' && isSingleWord(text)

      // Start translate + lemmatize
      const translateFetch = llmFetch('/api/translate', { text, direction })
      const lemmaFetch: Promise<Response | null> = single
        ? llmFetch('/api/lemmatize', { text })
        : Promise.resolve(null)

      // pl-en multi-word: fire analyze-sentence in parallel immediately
      const canAnalyzeNow = direction === 'pl-en' && !single
      if (canAnalyzeNow) setWordPhase('loading')
      const analyzeFetch: Promise<Response> | null = canAnalyzeNow
        ? llmFetch('/api/analyze-sentence', { sentence: text, sourceLang: 'pl' })
        : null

      const [translateRes, lemmaRes] = await Promise.all([translateFetch, lemmaFetch])

      if (!translateRes.ok) {
        setErrorCode(await readLlmError(translateRes))
        throw new Error()
      }
      const { translation } = await translateRes.json()

      let lemma = text
      let type: WordType = 'unknown'
      let gender = ''
      let canonicalEn = translation
      if (lemmaRes?.ok) {
        const data = await lemmaRes.json()
        lemma = data.lemma
        type = data.type
        gender = data.gender ?? ''
        canonicalEn = data.canonicalEn || translation
      }

      const plSentence = direction === 'pl-en' ? text : translation
      const enSentence = direction === 'pl-en' ? translation : text

      setResult({ translation, lemma, type, gender, isSingleWord: single, canonicalEn, plSentence, enSentence })
      setPhase('done')

      // Resolve word analysis (independent of main phase)
      if (analyzeFetch) {
        // pl-en: already in flight — await and apply
        try {
          const analyzeRes = await analyzeFetch
          if (translateIdRef.current !== myId) return
          if (analyzeRes.ok) {
            const data = await analyzeRes.json()
            setWords(data.words ?? [])
          }
        } catch { /* silent */ }
        if (translateIdRef.current === myId) setWordPhase('done')
      } else if (direction === 'en-pl' && !isSingleWord(translation)) {
        // en-pl: sequential — Polish output now known
        if (translateIdRef.current !== myId) return
        setWordPhase('loading')
        try {
          const analyzeRes = await llmFetch('/api/analyze-sentence', { sentence: translation, sourceLang: 'pl' })
          if (translateIdRef.current !== myId) return
          if (analyzeRes.ok) {
            const data = await analyzeRes.json()
            setWords(data.words ?? [])
          }
        } catch { /* silent */ }
        if (translateIdRef.current === myId) setWordPhase('done')
      }
    } catch {
      setPhase('error')
      setWordPhase('idle')
    }
  }

  function handleSwap() {
    translateIdRef.current++
    const nextDir: Direction = direction === 'pl-en' ? 'en-pl' : 'pl-en'
    setDirection(nextDir)
    if (result?.translation) setInput(result.translation)
    setResult(null)
    setPhase('idle')
    setWords([])
    setWordPhase('idle')
    // No focus here on purpose: focusing would pop the keyboard mid-swap
  }

  function handleAdd() {
    if (!result) return
    // onAddCard (App) fires the global "added to vocabulary" toast.
    onAddCard(buildEntry(result.lemma, result.canonicalEn, result.type, result.gender))
    // Single-word card added → clear the page (this path is only reachable for
    // single words; sentence translations aren't swipe-savable, so they stay).
    handleDismiss()
  }

  function handleDismiss() {
    translateIdRef.current++
    setInput('')
    setResult(null)
    setPhase('idle')
    setAdded(false)
    setWords([])
    setWordPhase('idle')
  }

  function handleAddMiningCard(word: AnalyzedWord) {
    if (!result) return
    const entry = buildMiningEntry(word, result.plSentence, result.enSentence)
    saveCard(entry)
    onAddCard(entry) // fires the global toast
    setSavedSet(prev => {
      const next = new Set([...prev, word.lemma.toLowerCase()])
      // The step asks for both words, so it completes on the second one.
      if (tourActive && words.length > 0 && words.every(w => next.has(w.lemma.toLowerCase()))) {
        onTourEvent?.('words-added')
      }
      return next
    })
  }

  function handleDragEnd(_: unknown, info: { offset: { x: number }; velocity: { x: number } }) {
    const threshold = window.innerWidth * 0.30
    const goRight = info.offset.x > threshold || info.velocity.x > 400
    const goLeft = info.offset.x < -threshold || info.velocity.x < -400
    if (goRight && canSwipe) {
      haptics.swipeRight()
      animate(x, 700, { duration: 0.25 })
      setTimeout(() => { x.set(0); handleAdd() }, 270)
    } else if (goLeft) {
      // Left swipe clears everything — input and translation
      haptics.swipeLeft()
      animate(x, -700, { duration: 0.25 })
      setTimeout(() => { x.set(0); handleDismiss() }, 270)
    } else {
      animate(x, 0, { type: 'spring', stiffness: 300, damping: 25 })
    }
  }

  const alreadySaved = result?.isSingleWord ? !!findByLemma(result.lemma) : false
  const canSwipe = !!(result?.isSingleWord && !added && !alreadySaved)

  const wordListBlock = wordPhase === 'loading' ? (
    <div className="flex items-center gap-2 pt-4 ink-tertiary">
      <span className="material-symbols-rounded animate-spin text-[16px]">progress_activity</span>
      <span className="font-instrument text-[13px]">Analysing words…</span>
    </div>
  ) : wordPhase === 'done' && words.length > 1 ? (
    <div className="pt-4">
      <p className="mb-2 font-instrument text-[11px] uppercase tracking-wider ink-tertiary">
        {srcTop ? 'Words in this sentence' : 'Words in the Polish translation'}
      </p>
      {words.map(word => (
        <WordRow
          key={word.lemma}
          word={word}
          isSaved={savedSet.has(word.lemma.toLowerCase())}
          onAdd={() => handleAddMiningCard(word)}
        />
      ))}
    </div>
  ) : null

  // Translation is the only thing this page does, and it is the one feature that
  // needs its own key. Saying so up front beats letting someone type a sentence,
  // press the button and meet a failure — which is what happened before.
  const needsKey = !getDeepLKey() && !tourActive

  const inputBlock = (
    <>
      {/* Compact on purpose. This sits in a fixed-height band that is
          bottom-aligned, so a tall notice pushes the input up and under the
          status bar — which is exactly what a three-line version did on the
          device. One row, and the explanation lives in settings. */}
      {needsKey && (
        <button
          onClick={() => onChangePage('api_config')}
          className="mb-3 flex items-center gap-2 self-start rounded-full border border-accent/30 bg-accent/[0.08] px-3.5 py-1.5"
        >
          <span className="material-symbols-rounded text-[15px] text-accent">key</span>
          <span className="font-instrument text-[13px] text-ink/80">
            Needs a DeepL key — <span className="text-accent underline underline-offset-2">add one</span>
          </span>
        </button>
      )}
      <div ref={setAnchor('translate-input')} className="relative rounded-[20px] border border-ink/20 shadow-[0_8px_32px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.18)]">
        <GlassPane borderRadius={20} className="absolute inset-0 rounded-[20px] pane-field-soft" />
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => { setInput(e.target.value); if (phase === 'error') setPhase('idle') }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTranslate() } }}
          readOnly={tourActive}
          tabIndex={tourActive ? -1 : undefined}
          placeholder={srcTop ? 'Wpisz tekst…' : 'Translate text…'}
          rows={2}
          className="relative z-10 w-full resize-none bg-transparent py-4 pl-6 pr-12 font-instrument text-[17px] text-ink/95 placeholder-tertiary outline-none"
        />
        {!!input && !tourActive && (
          <button
            onClick={() => setInput('')}
            aria-label="Clear input"
            className="absolute right-3 top-3 z-20 flex h-[24px] w-[24px] items-center justify-center rounded-full text-ink/60 transition-colors hover:text-ink"
          >
            <GlassPane borderRadius={12} className="absolute inset-0 z-0 rounded-full bg-ink/15" />
            <span className="material-symbols-rounded relative z-10 text-[16px]">close</span>
          </button>
        )}
      </div>

      <GlassButton
        ref={setAnchor('translate-button')}
        variant="primary"
        onClick={handleTranslate}
        disabled={!input.trim() || phase === 'loading'}
        className="mt-3 w-full py-3.5 font-instrument text-[15px] disabled:opacity-35"
      >
        {phase === 'loading' ? 'Translating…' : 'Translate'}
      </GlassButton>

      {phase === 'error' && (
        <p className="mt-2 text-center font-instrument text-[12px] text-red-400/80">
          {llmErrorMessage(errorCode)}
          {errorCode === 'not_configured' && (
            <>
              {' — '}
              <button
                onClick={() => onChangePage('api_config')}
                className="font-semibold text-accent underline underline-offset-2"
              >
                add one in App settings
              </button>
            </>
          )}
        </p>
      )}
    </>
  )

  const resultBlock = phase === 'done' && result && (
    <>
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.8, right: canSwipe ? 0.8 : 0.08 }}
        onDragEnd={handleDragEnd}
        className="relative cursor-grab select-none rounded-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.25),inset_0_0_0_1px_rgba(255,255,255,0.12)] active:cursor-grabbing"
      >
        <GlassPane borderRadius={24} clipEllipseRef={circleRef} className="absolute inset-0 z-0 rounded-[24px] bg-ink/[0.02]" />

        {/* Swipe feedback wash, scaled to the card (mirrors the flashcard
            glows): green on the right (save), red on the left (clear). */}
        {canSwipe && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-[5] rounded-[24px]"
            style={{ opacity: addOpacity, background: 'radial-gradient(ellipse at right, rgba(39,209,178,0.5) 0%, transparent 88%)' }}
          />
        )}
        <motion.div
          className="pointer-events-none absolute inset-0 z-[5] rounded-[24px]"
          style={{ opacity: clearOpacity, background: 'radial-gradient(ellipse at left, rgba(222,0,4,0.5) 0%, transparent 88%)' }}
        />

        {canSwipe && (
          <motion.div style={{ opacity: addOpacity }}
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-end rounded-[24px] pr-6">
            <span className="font-instrument text-[18px] font-semibold text-emerald-400/90">Add →</span>
          </motion.div>
        )}
        <motion.div style={{ opacity: clearOpacity }}
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-start rounded-[24px] pl-6">
          <span className="font-instrument text-[18px] font-semibold ink-tertiary">← Clear</span>
        </motion.div>

        <div className="relative z-20 flex flex-col gap-4 p-6">
          <p className="font-instrument text-[28px] italic leading-tight text-accent">
            {result.translation}
          </p>

          {result.isSingleWord && (
            <>
              <div className="h-[1px] w-full bg-ink/10" />
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <span className="font-instrument text-[18px] font-medium text-ink/80">
                    {result.lemma}
                  </span>
                  {result.gender && (
                    <span className="font-instrument text-[15px] italic " style={{ color: 'var(--aspect)' }}>
                      {result.gender}
                    </span>
                  )}
                  <div className="relative flex items-center justify-center overflow-hidden rounded-[124px] border border-ink/20 bg-ink/10 px-3 py-[3px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]">
                    <div
                      className="absolute inset-0 z-0 flex items-center justify-center opacity-70 mix-blend-screen"
                      dangerouslySetInnerHTML={{ __html: tagGradients[result.type] ?? tagGradients['unknown'] }}
                    />
                    <span className="relative z-10 font-instrument text-[10px] font-medium capitalize text-ink">
                      {typeLabel(result.type)}
                    </span>
                  </div>
                </div>
                {result.canonicalEn && result.canonicalEn !== result.translation && (
                  <span className="font-instrument text-[13px] ink-tertiary">{result.canonicalEn}</span>
                )}
              </div>

              {added && (
                <p className="font-instrument text-[13px] text-emerald-400/80">Added to vocabulary</p>
              )}
              {!added && alreadySaved && (
                <p className="font-instrument text-[13px] ink-tertiary">Already in your vocabulary</p>
              )}
            </>
          )}
        </div>
      </motion.div>

      <p className="mt-4 font-instrument text-[11px] ink-tertiary">
        {canSwipe ? 'swipe right to save · swipe left to clear' : 'swipe left to clear'}
      </p>
    </>
  )

  return (
    <div className="fixed inset-0 overflow-hidden">

      {/* The gradient circle backing the source side (Figma 114-13508) is
          rendered procedurally into the WebGL background (see backgroundData.ts
          `translate`) so the page's glass panes refract it natively; its
          vertical slide on swap is driven via blobTop -> glassStore above.

          Without a canvas there is no procedural blob at all, so css/svg mode
          re-renders the original Figma artwork as a DOM layer, clipped to the
          ring ellipse. It is the same drawing backgroundData.ts transcribes,
          and then some: the shader's transcription keeps only the four
          coloured ellipses and drops the two white stroke sweeps, which the
          SVG still has. Its own feGaussianBlur (stdDeviation 31.85 over a
          959.4-wide viewBox → ~28px at this scale) stands in for the layer's
          blurPx: 30, so no CSS blur is added on top. As an <img> the whole
          thing — filter included — rasterises once. */}
      {!isWebgl && (
        <motion.img
          src={translateBlobUrl}
          alt=""
          aria-hidden
          className="pointer-events-none absolute z-0 max-w-none mix-blend-screen"
          style={{
            width: `${BLOB_W_VW}vw`,
            height: `${BLOB_H_VH}vh`,
            left: `${BLOB_LEFT_VW}vw`,
            top: `${BLOB_TOP_SRC * 100}vh`,
            opacity: 'var(--blob-opacity)',
            WebkitMaskImage: BLOB_MASK,
            maskImage: BLOB_MASK,
          }}
          initial={false}
          animate={{ y: srcTop ? '0vh' : `${BLOB_TRAVEL_VH}vh` }}
          transition={SPRING}
        />
      )}

      {/* Soft edge ring marking the source side, sliding with the blob. Also
          the tracked box for the elliptical glass-disc mask pane (see the
          circle-mask effect above). */}
      <motion.div
        ref={circleRef}
        className="pointer-events-none absolute left-1/2 z-0 -translate-x-1/2 rounded-[50%] border border-ink/10"
        style={{ width: `${CIRCLE_W}vw`, height: `${CIRCLE_H}vh` }}
        initial={false}
        animate={{ top: srcTop ? `${BOUNDARY - CIRCLE_H + EDGE_OFFSET}vh` : `${100 - BOUNDARY - EDGE_OFFSET}vh` }}
        transition={SPRING}
      />

      {/* ── Polish — fixed top section ─────────────────────────── */}
      <div className="absolute inset-x-0 top-0 z-10 flex h-[51.4%] flex-col justify-end overflow-hidden px-8 pb-[14vh] pt-[calc(0.5rem+env(safe-area-inset-top))]">
        <p className="mb-3 font-instrument text-[15px] font-medium text-ink/70">Polish</p>
        {srcTop ? inputBlock : (
          <div ref={setAnchor('translate-result')} className="no-scrollbar overflow-y-auto">{resultBlock}{wordListBlock}</div>
        )}
      </div>

      {/* ── Swap button on the boundary ────────────────────────── */}
      <GlassButton
        onClick={handleSwap}
        aria-label="Swap languages"
        radius={20}
        pane="pane-neutral"
        className="swap-btn absolute left-1/2 z-20 h-[42px] w-[42px] -translate-x-1/2 -translate-y-1/2 border border-ink/10"
        style={{ top: `${BOUNDARY}vh` }}
      >
        <motion.span
          className="material-symbols-rounded text-[20px] text-ink/60"
          initial={false}
          animate={{ rotate: srcTop ? 0 : 90 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        >
          sync_alt
        </motion.span>
      </GlassButton>

      {/* ── English — fixed bottom section ─────────────────────── */}
      {/* pt reduced (9.5vh -> 6vh) so the English input + Translate button sit
          higher and clear the floating bottom nav on shorter viewports. */}
      {/* When this side holds the result (srcTop), raise it up into the circle
          and mask it so the text disappears under the circle's curve, matching
          the glass. When it holds the input, keep the original geometry. */}
      <div
        className="absolute inset-x-0 bottom-0 z-10 flex flex-col overflow-y-auto no-scrollbar px-8 pb-[110px]"
        style={{
          top: `${srcTop ? BOUNDARY - CLIP_OVER : BOUNDARY}vh`,
          paddingTop: `${srcTop ? 6 + CLIP_OVER : 6}vh`,
          ...(srcTop ? circleMask(CIRCLE_CY_TOP - (BOUNDARY - CLIP_OVER)) : {}),
        }}
      >
        <p className="mb-3 font-instrument text-[15px] font-medium text-ink/70">English</p>
        {srcTop ? <div ref={setAnchor('translate-result')}>{resultBlock}{wordListBlock}</div> : inputBlock}
      </div>
    </div>
  )
}
