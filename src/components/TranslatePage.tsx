import { useState, useRef } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import GlassPane from './GlassPane'
import GlassButton from './GlassButton'
import { tagGradients } from '../data/gradients'
import { findByLemma } from '../lib/storage'
import type { VocabEntry, WordType } from '../data/types'
import gradientUrl from '../assets/translate-gradient.svg'

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

interface Result {
  translation: string
  lemma: string
  type: WordType
  gender: string
  isSingleWord: boolean
  canonicalEn: string
}

interface Props {
  onAddCard: (entry: VocabEntry) => void
}

const isSingleWord = (text: string) => {
  const words = text.trim().split(/\s+/)
  return words.length === 1 || (words.length === 2 && words[1].toLowerCase() === 'się')
}

export default function TranslatePage({ onAddCard }: Props) {
  const [input, setInput] = useState('')
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<Result | null>(null)
  const [added, setAdded] = useState(false)
  const [direction, setDirection] = useState<Direction>('pl-en')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const x = useMotionValue(0)
  const addOpacity = useTransform(x, [0, 80], [0, 1])
  const clearOpacity = useTransform(x, [-80, 0], [1, 0])

  const srcTop = direction === 'pl-en' // source = Polish (top) or English (bottom)

  async function handleTranslate() {
    const text = input.trim()
    if (!text || phase === 'loading') return
    setPhase('loading')
    setResult(null)
    setAdded(false)
    x.set(0)

    try {
      const single = direction === 'pl-en' && isSingleWord(text)
      const [translateRes, lemmaRes] = await Promise.all([
        fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, direction }),
        }),
        single
          ? fetch('/api/lemmatize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text }),
            })
          : Promise.resolve(null),
      ])

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

      setResult({ translation, lemma, type, gender, isSingleWord: single, canonicalEn })
      setPhase('done')
    } catch {
      setPhase('error')
    }
  }

  function handleSwap() {
    const nextDir: Direction = direction === 'pl-en' ? 'en-pl' : 'pl-en'
    setDirection(nextDir)
    // Move the current translation output back into the input
    if (result?.translation) setInput(result.translation)
    setResult(null)
    setPhase('idle')
    // No focus here on purpose: focusing would pop the keyboard mid-swap;
    // the field activates only when the user taps it
  }

  function handleAdd() {
    if (!result) return
    onAddCard(buildEntry(result.lemma, result.canonicalEn, result.type, result.gender))
    setAdded(true)
  }

  function handleDismiss() {
    setInput('')
    setResult(null)
    setPhase('idle')
    setAdded(false)
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

  const inputBlock = (
    <>
      <div className="relative rounded-[16px] shadow-[0_8px_32px_rgba(0,0,0,0.20),inset_0_0_0_1px_rgba(255,255,255,0.18)]">
        <GlassPane borderRadius={16} className="absolute inset-0 rounded-[16px] bg-white/[0.06]" />
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => { setInput(e.target.value); if (phase === 'error') setPhase('idle') }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTranslate() } }}
          placeholder={srcTop ? 'pisz tutaj...' : 'Translate text…'}
          rows={2}
          className="relative z-10 w-full resize-none bg-transparent py-4 pl-6 pr-12 font-instrument text-[17px] text-white/95 placeholder:text-white/40 outline-none"
        />
        {!!input && (
          <button
            onClick={() => setInput('')}
            aria-label="Clear input"
            className="absolute right-3 top-3 z-20 flex h-[24px] w-[24px] items-center justify-center rounded-full bg-white/15 text-white/60 transition-colors hover:bg-white/25 hover:text-white"
          >
            <span className="material-symbols-rounded text-[16px]">close</span>
          </button>
        )}
      </div>

      <GlassButton
        onClick={handleTranslate}
        disabled={!input.trim() || phase === 'loading'}
        radius={14}
        pane="bg-white/[0.07]"
        className="mt-3 w-full border border-white/15 py-3 font-instrument text-[15px] font-medium text-white/75 disabled:opacity-35"
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
        <GlassPane borderRadius={24} className="absolute inset-0 z-0 rounded-[24px] bg-white/[0.02]" />

        {canSwipe && (
          <motion.div style={{ opacity: addOpacity }}
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-end rounded-[24px] pr-6">
            <span className="font-instrument text-[18px] font-semibold text-emerald-400/90">Add →</span>
          </motion.div>
        )}
        <motion.div style={{ opacity: clearOpacity }}
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-start rounded-[24px] pl-6">
          <span className="font-instrument text-[18px] font-semibold text-white/50">← Clear</span>
        </motion.div>

        <div className="relative z-20 flex flex-col gap-4 p-6">
          <p className="font-instrument text-[28px] italic leading-tight text-[#B4A0FF]">
            {result.translation}
          </p>

          {result.isSingleWord && (
            <>
              <div className="h-[1px] w-full bg-white/8" />
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <span className="font-instrument text-[18px] font-medium text-white/80">
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
                  <span className="font-instrument text-[13px] text-white/35">{result.canonicalEn}</span>
                )}
              </div>

              {added && (
                <p className="font-instrument text-[13px] text-emerald-400/80">Added to vocabulary</p>
              )}
              {!added && alreadySaved && (
                <p className="font-instrument text-[13px] text-white/30">Already in your vocabulary</p>
              )}
            </>
          )}
        </div>
      </motion.div>

      <p className="mt-4 font-instrument text-[11px] text-white/20">
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
        className="pointer-events-none absolute left-1/2 z-0 -translate-x-1/2 overflow-hidden rounded-[50%]"
        style={{ width: `${CIRCLE_W}vw`, height: `${CIRCLE_H}vh` }}
        initial={false}
        animate={{ top: srcTop ? `${BOUNDARY - CIRCLE_H}vh` : `${100 - BOUNDARY}vh` }}
        transition={SPRING}
      >
        <img
          src={gradientUrl}
          alt=""
          className="absolute max-w-none"
          style={{ left: '-11.3%', top: '0%', width: '149.4%', height: '116%' }}
        />
      </motion.div>

      {/* Doubled soft edge — the second circle 20px into the dark side */}
      <motion.div
        className="pointer-events-none absolute left-1/2 z-0 -translate-x-1/2 rounded-[50%] border border-white/10"
        style={{ width: `${CIRCLE_W}vw`, height: `${CIRCLE_H}vh` }}
        initial={false}
        animate={{ top: srcTop ? `${BOUNDARY - CIRCLE_H + EDGE_OFFSET}vh` : `${100 - BOUNDARY - EDGE_OFFSET}vh` }}
        transition={SPRING}
      />

      {/* ── Polish — fixed top section ─────────────────────────── */}
      <div className="absolute inset-x-0 top-0 z-10 flex h-[51.4%] flex-col justify-end px-8 pb-[13vh]">
        <p className="mb-3 font-instrument text-[15px] font-medium text-white/70">Polish</p>
        {srcTop ? inputBlock : (
          <div className="overflow-y-auto no-scrollbar">{resultBlock}</div>
        )}
      </div>

      {/* ── Swap button on the boundary ────────────────────────── */}
      <GlassButton
        onClick={handleSwap}
        aria-label="Swap languages"
        radius={21}
        pane="bg-[#181818]/80"
        className="absolute left-1/2 z-20 h-[42px] w-[42px] -translate-x-1/2 -translate-y-1/2 border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.6)]"
        style={{ top: `${BOUNDARY}vh` }}
      >
        <motion.span
          className="material-symbols-rounded text-[20px] text-white/60"
          initial={false}
          animate={{ rotate: srcTop ? 0 : 90 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        >
          sync_alt
        </motion.span>
      </GlassButton>

      {/* ── English — fixed bottom section ─────────────────────── */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col px-8 pt-[9.5vh] pb-[110px] overflow-y-auto no-scrollbar" style={{ top: `${BOUNDARY}vh` }}>
        <p className="mb-3 font-instrument text-[15px] font-medium text-white/70">English</p>
        {srcTop ? resultBlock : inputBlock}
      </div>
    </div>
  )
}
