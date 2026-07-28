import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, useMotionValueEvent, animate } from 'framer-motion'
import GlassPane from './GlassPane'
import GlassButton from './GlassButton'
import { tagGradients } from '../data/gradients'
import { findByLemma, getCards, saveCard } from '../lib/storage'
import type { VocabEntry, WordType } from '../data/types'
import gradientUrl from '../assets/translate-gradient.svg'
import { generateMaskGlassCanvas, GLASS_OVERSCAN } from '../lib/generateGlassMap'
import { registerMaskPane, pokeRenderer } from '../webgl/glassStore'
import { getGlassMode } from '../lib/glassMode'

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

// Free-form mask glass for the background blob (webgl mode only): an
// ellipse matching its rounded-[50%] box, so refraction and rim light
// follow the true elliptical silhouette instead of GlassPane's rounded-rect
// approximation (which would read as a flat-sided pill on this aspect ratio).
function drawCircleMask(w: number, h: number) {
  return (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

// The blob's displacement map only depends on viewport size, but building it is
// ~25M ops of blocking JS (getImageData + two box-blur passes over a ~425K-px
// canvas). Cache it per dimension so navigating back to the page never rebuilds
// it, and defer the first build off the page-open critical path.
const blobMaskCache = new Map<string, { canvas: HTMLCanvasElement; scale: number }>()

function buildBlobMask(w: number, h: number): { canvas: HTMLCanvasElement; scale: number } {
  const key = `${w}x${h}`
  let entry = blobMaskCache.get(key)
  if (!entry) {
    const { canvas, scale } = generateMaskGlassCanvas(w, h, drawCircleMask(w, h), {
      blurRadius: 5, scale: 40, highlight: 0.5, shade: 0.15, coverageAlpha: true,
    })
    entry = { canvas, scale }
    blobMaskCache.set(key, entry)
  }
  return entry
}

// Pre-build the blob's glass map ahead of time (called during app idle) so the
// first open of the translate page shows its refraction immediately rather than
// a beat later — the build stays off every critical path. Idempotent (cached).
export function warmBlobMask() {
  if (getGlassMode() !== 'webgl') return
  const w = Math.round(window.innerWidth * CIRCLE_W / 100)
  const h = Math.round(window.innerHeight * CIRCLE_H / 100)
  buildBlobMask(w, h)
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
  unknown:   'text-[#B4A0FF] bg-[#B4A0FF]/10 border-[#B4A0FF]/25',
}

function WordRow({ word, isSaved, onAdd }: { word: AnalyzedWord; isSaved: boolean; onAdd: () => void }) {
  return (
    <div className="flex items-center gap-2 border-b border-[#F8FAFC]/[0.06] py-2.5 last:border-0">
      <span className={`shrink-0 rounded-full border px-2 py-0.5 font-instrument text-[10px] font-medium capitalize ${TYPE_BADGE[word.type] ?? TYPE_BADGE.unknown}`}>
        {word.type === 'adjective' ? 'adj' : word.type}
      </span>
      <span className="min-w-0 truncate font-instrument text-[15px] font-medium text-[#F8FAFC]/90">{word.lemma}</span>
      {word.gender && <span className="shrink-0 font-instrument text-[13px] italic text-[#e879f9]">{word.gender}</span>}
      <span className="shrink-0 text-[#F8FAFC]/20">·</span>
      <span className="min-w-0 flex-1 truncate font-instrument text-[13px] text-[#F8FAFC]/50">{word.english}</span>
      {isSaved ? (
        <span className="shrink-0 whitespace-nowrap font-instrument text-[11px] text-[#F8FAFC]/25">✓ In vocabulary</span>
      ) : (
        <button
          onClick={onAdd}
          className="relative shrink-0 overflow-hidden whitespace-nowrap rounded-full border border-[#F8FAFC]/15 px-3 py-1 font-instrument text-[11px] text-[#F8FAFC]/60 transition-colors hover:text-[#F8FAFC]"
        >
          <GlassPane borderRadius={999} className="absolute inset-0 z-0 rounded-full bg-[#F8FAFC]/5" />
          <span className="relative z-10">+ Add card</span>
        </button>
      )}
    </div>
  )
}

export default function TranslatePage({ onAddCard }: Props) {
  const glassMode = getGlassMode()
  // In webgl mode the shared canvas glass is hidden behind the gradient <img>,
  // so the input/buttons show a flat tint. A scoped backdrop-filter frosts the
  // real DOM gradient directly behind them (no transformed ancestor here, so it
  // works) — svg/css mode already frosts via the pane's ::before, so skip it.
  const frostStyle = glassMode === 'webgl'
    ? { backdropFilter: 'blur(8px) saturate(1.3)', WebkitBackdropFilter: 'blur(8px) saturate(1.3)' }
    : undefined
  const circleRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<Result | null>(null)
  const [added, setAdded] = useState(false)
  const [direction, setDirection] = useState<Direction>('pl-en')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [wordPhase, setWordPhase] = useState<'idle' | 'loading' | 'done'>('idle')
  const [words, setWords] = useState<AnalyzedWord[]>([])
  const [savedSet, setSavedSet] = useState<Set<string>>(() => new Set(getCards().map(c => c.pl.toLowerCase())))
  const [toast, setToast] = useState<string | null>(null)
  const translateIdRef = useRef(0)

  // Register the background blob as a mask pane so it gets real refraction +
  // rim light instead of just its pre-blurred image. Its box tracks the
  // viewport (CIRCLE_W/H are vw/vh), so the map only needs rebuilding on
  // resize — its on-screen position (swap animation) is read live every
  // frame by GlassCanvas, no regeneration needed for that.
  useEffect(() => {
    if (glassMode !== 'webgl') return
    const el = circleRef.current
    if (!el) return

    let unregister: (() => void) | null = null
    let idleHandle: number | null = null
    let cancelled = false

    function register() {
      const w = Math.round(window.innerWidth * CIRCLE_W / 100)
      const h = Math.round(window.innerHeight * CIRCLE_H / 100)
      const { canvas, scale } = buildBlobMask(w, h)
      if (cancelled) return
      unregister = registerMaskPane({ el: el!, map: canvas, scale, overscan: GLASS_OVERSCAN })
    }

    // Cached map → register right away (cheap). First-time build → defer off the
    // page-open critical path so navigating here never blocks on it; the blob
    // shows its gradient meanwhile and gains the refraction rim a beat later.
    const key = `${Math.round(window.innerWidth * CIRCLE_W / 100)}x${Math.round(window.innerHeight * CIRCLE_H / 100)}`
    if (blobMaskCache.has(key)) {
      register()
    } else if (window.requestIdleCallback) {
      idleHandle = window.requestIdleCallback(() => { idleHandle = null; register() }, { timeout: 500 })
    } else {
      idleHandle = window.setTimeout(() => { idleHandle = null; register() }, 0)
    }

    function onResize() {
      unregister?.()
      unregister = null
      register()
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelled = true
      window.removeEventListener('resize', onResize)
      if (idleHandle != null) {
        if (window.cancelIdleCallback) window.cancelIdleCallback(idleHandle)
        else clearTimeout(idleHandle)
      }
      unregister?.()
    }
  }, [glassMode])

  const x = useMotionValue(0)
  const addOpacity = useTransform(x, [0, 80], [0, 1])
  const clearOpacity = useTransform(x, [-80, 0], [1, 0])
  // Keep the WebGL glass tracking the result card during swipe so it doesn't ghost.
  useMotionValueEvent(x, 'change', pokeRenderer)

  const srcTop = direction === 'pl-en' // source = Polish (top) or English (bottom)

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

    try {
      const single = direction === 'pl-en' && isSingleWord(text)

      // Start translate + lemmatize
      const translateFetch = fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, direction }),
      })
      const lemmaFetch: Promise<Response | null> = single
        ? fetch('/api/lemmatize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
          })
        : Promise.resolve(null)

      // pl-en multi-word: fire analyze-sentence in parallel immediately
      const canAnalyzeNow = direction === 'pl-en' && !single
      if (canAnalyzeNow) setWordPhase('loading')
      const analyzeFetch: Promise<Response> | null = canAnalyzeNow
        ? fetch('/api/analyze-sentence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sentence: text, sourceLang: 'pl' }),
          })
        : null

      const [translateRes, lemmaRes] = await Promise.all([translateFetch, lemmaFetch])

      if (!translateRes.ok) throw new Error()
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
          const analyzeRes = await fetch('/api/analyze-sentence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sentence: translation, sourceLang: 'pl' }),
          })
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
    onAddCard(buildEntry(result.lemma, result.canonicalEn, result.type, result.gender))
    setAdded(true)
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
    onAddCard(entry)
    setSavedSet(prev => new Set([...prev, word.lemma.toLowerCase()]))
    setToast(`${word.lemma} added to vocabulary`)
    setTimeout(() => setToast(null), 2500)
  }

  function handleDragEnd(_: unknown, info: { offset: { x: number }; velocity: { x: number } }) {
    const threshold = window.innerWidth * 0.30
    const goRight = info.offset.x > threshold || info.velocity.x > 400
    const goLeft = info.offset.x < -threshold || info.velocity.x < -400
    if (goRight && canSwipe) {
      animate(x, 700, { duration: 0.25 })
      setTimeout(() => { x.set(0); handleAdd() }, 270)
    } else if (goLeft) {
      // Left swipe clears everything — input and translation
      animate(x, -700, { duration: 0.25 })
      setTimeout(() => { x.set(0); handleDismiss() }, 270)
    } else {
      animate(x, 0, { type: 'spring', stiffness: 300, damping: 25 })
    }
  }

  const alreadySaved = result?.isSingleWord ? !!findByLemma(result.lemma) : false
  const canSwipe = !!(result?.isSingleWord && !added && !alreadySaved)

  const wordListBlock = wordPhase === 'loading' ? (
    <div className="flex items-center gap-2 pt-4 text-[#F8FAFC]/30">
      <span className="material-symbols-rounded animate-spin text-[16px]">progress_activity</span>
      <span className="font-instrument text-[13px]">Analysing words…</span>
    </div>
  ) : wordPhase === 'done' && words.length > 1 ? (
    <div className="pt-4">
      <p className="mb-2 font-instrument text-[11px] uppercase tracking-wider text-[#F8FAFC]/25">
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

  const inputBlock = (
    <>
      <div
        className="relative overflow-hidden rounded-[20px] shadow-[0_8px_32px_rgba(0,0,0,0.20),inset_0_0_0_1px_rgba(255,255,255,0.18)]"
        style={frostStyle}
      >
        <GlassPane borderRadius={20} className="absolute inset-0 rounded-[20px] bg-[#F8FAFC]/[0.06]" />
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => { setInput(e.target.value); if (phase === 'error') setPhase('idle') }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTranslate() } }}
          placeholder={srcTop ? 'pisz tutaj...' : 'Translate text…'}
          rows={2}
          className="relative z-10 w-full resize-none bg-transparent py-4 pl-6 pr-12 font-instrument text-[17px] text-[#F8FAFC]/95 placeholder:text-[#F8FAFC]/40 outline-none"
        />
        {!!input && (
          <button
            onClick={() => setInput('')}
            aria-label="Clear input"
            className="absolute right-3 top-3 z-20 flex h-[24px] w-[24px] items-center justify-center rounded-full text-[#F8FAFC]/60 transition-colors hover:text-[#F8FAFC]"
          >
            <GlassPane borderRadius={12} className="absolute inset-0 z-0 rounded-full bg-[#F8FAFC]/15" />
            <span className="material-symbols-rounded relative z-10 text-[16px]">close</span>
          </button>
        )}
      </div>

      <GlassButton
        onClick={handleTranslate}
        disabled={!input.trim() || phase === 'loading'}
        radius={24}
        pane="bg-[#B4A0FF]/15"
        style={frostStyle}
        className="mt-3 w-full border border-[#B4A0FF]/25 py-3.5 font-instrument text-[15px] font-medium text-[#B4A0FF] disabled:opacity-35"
      >
        {phase === 'loading' ? 'Translating…' : 'Translate'}
      </GlassButton>

      {phase === 'error' && (
        <p className="mt-2 text-center font-instrument text-[12px] text-red-400/70">
          Translation unavailable — check your connection
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
        className="relative cursor-grab select-none rounded-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_0_0_1px_rgba(255,255,255,0.12)] active:cursor-grabbing"
      >
        <GlassPane borderRadius={24} className="absolute inset-0 z-0 rounded-[24px] bg-[#F8FAFC]/[0.02]" />

        {canSwipe && (
          <motion.div style={{ opacity: addOpacity }}
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-end rounded-[24px] pr-6">
            <span className="font-instrument text-[18px] font-semibold text-emerald-400/90">Add →</span>
          </motion.div>
        )}
        <motion.div style={{ opacity: clearOpacity }}
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-start rounded-[24px] pl-6">
          <span className="font-instrument text-[18px] font-semibold text-[#F8FAFC]/50">← Clear</span>
        </motion.div>

        <div className="relative z-20 flex flex-col gap-4 p-6">
          <p className="font-instrument text-[28px] italic leading-tight text-[#B4A0FF]">
            {result.translation}
          </p>

          {result.isSingleWord && (
            <>
              <div className="h-[1px] w-full bg-[#F8FAFC]/8" />
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <span className="font-instrument text-[18px] font-medium text-[#F8FAFC]/80">
                    {result.lemma}
                  </span>
                  {result.gender && (
                    <span className="font-instrument text-[15px] italic text-[#e879f9]">
                      {result.gender}
                    </span>
                  )}
                  <div className="relative flex items-center justify-center overflow-hidden rounded-[124px] border border-[#F8FAFC]/20 bg-[#F8FAFC]/10 px-[12px] py-[3px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]">
                    <div
                      className="absolute inset-0 z-0 flex items-center justify-center opacity-70 mix-blend-screen"
                      dangerouslySetInnerHTML={{ __html: tagGradients[result.type] ?? tagGradients['unknown'] }}
                    />
                    <span className="relative z-10 font-instrument text-[10px] font-medium capitalize text-[#F8FAFC]">
                      {result.type}
                    </span>
                  </div>
                </div>
                {result.canonicalEn && result.canonicalEn !== result.translation && (
                  <span className="font-instrument text-[13px] text-[#F8FAFC]/35">{result.canonicalEn}</span>
                )}
              </div>

              {added && (
                <p className="font-instrument text-[13px] text-emerald-400/80">Added to vocabulary</p>
              )}
              {!added && alreadySaved && (
                <p className="font-instrument text-[13px] text-[#F8FAFC]/30">Already in your vocabulary</p>
              )}
            </>
          )}
        </div>
      </motion.div>

      <p className="mt-4 font-instrument text-[11px] text-[#F8FAFC]/20">
        {canSwipe ? 'swipe right to save · swipe left to clear' : 'swipe left to clear'}
      </p>
    </>
  )

  return (
    <div className="fixed inset-0 overflow-hidden">

      {/* Gradient circle backing the source side (Figma 114-13508), sliding
          between halves on language swap. The global dots background shows
          through everywhere else. */}
      <motion.div
        ref={circleRef}
        className="pointer-events-none absolute left-1/2 z-0 -translate-x-1/2 overflow-hidden rounded-[50%]"
        style={{ width: `${CIRCLE_W}vw`, height: `${CIRCLE_H}vh` }}
        initial={false}
        animate={{ top: srcTop ? `${BOUNDARY - CIRCLE_H}vh` : `${100 - BOUNDARY}vh` }}
        transition={SPRING}
      >
        <img
          src={gradientUrl}
          alt=""
          className={`absolute max-w-none ${glassMode === 'webgl' ? 'opacity-80' : ''}`}
          style={{ left: '-11.3%', top: '-5%', width: '149.4%', height: '116%' }}
        />
      </motion.div>

      {/* Doubled soft edge — the second circle 20px into the dark side */}
      <motion.div
        className="pointer-events-none absolute left-1/2 z-0 -translate-x-1/2 rounded-[50%] border border-[#F8FAFC]/10"
        style={{ width: `${CIRCLE_W}vw`, height: `${CIRCLE_H}vh` }}
        initial={false}
        animate={{ top: srcTop ? `${BOUNDARY - CIRCLE_H + EDGE_OFFSET}vh` : `${100 - BOUNDARY - EDGE_OFFSET}vh` }}
        transition={SPRING}
      />

      {/* ── Polish — fixed top section ─────────────────────────── */}
      <div className="absolute inset-x-0 top-0 z-10 flex h-[51.4%] flex-col justify-end px-8 pb-[14vh]">
        <p className="mb-3 font-instrument text-[15px] font-medium text-[#F8FAFC]/70">Polish</p>
        {srcTop ? inputBlock : (
          <div className="no-scrollbar overflow-y-auto">{resultBlock}{wordListBlock}</div>
        )}
      </div>

      {/* ── Swap button on the boundary ────────────────────────── */}
      <GlassButton
        onClick={handleSwap}
        aria-label="Swap languages"
        radius={21}
        pane="bg-[#181818]/45"
        className="absolute left-1/2 z-20 h-[42px] w-[42px] -translate-x-1/2 -translate-y-1/2 border border-[#F8FAFC]/10 shadow-[0_4px_20px_rgba(0,0,0,0.6)]"
        style={{ top: `${BOUNDARY}vh`, ...frostStyle }}
      >
        <motion.span
          className="material-symbols-rounded text-[20px] text-[#F8FAFC]/60"
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
      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col overflow-y-auto no-scrollbar px-8 pt-[6vh] pb-[110px]" style={{ top: `${BOUNDARY}vh` }}>
        <p className="mb-3 font-instrument text-[15px] font-medium text-[#F8FAFC]/70">English</p>
        {srcTop ? <>{resultBlock}{wordListBlock}</> : inputBlock}
      </div>

      {/* ── Success toast ───────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-28 left-1/2 z-[80] -translate-x-1/2 overflow-hidden rounded-full border border-[#F8FAFC]/10 px-5 py-2"
          >
            <GlassPane borderRadius={999} className="absolute inset-0 z-0 rounded-full bg-[#F8FAFC]/10" />
            <span className="relative z-10 whitespace-nowrap font-instrument text-[14px] text-[#F8FAFC]/80">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
