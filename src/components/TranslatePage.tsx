import { useState, useRef } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import GlassPane from './GlassPane'
import { tagGradients } from '../data/gradients'
import { findByLemma } from '../lib/storage'
import type { VocabEntry, WordType } from '../data/types'

type Direction = 'pl-en' | 'en-pl'

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
  const [swapAngle, setSwapAngle] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const x = useMotionValue(0)
  const addOpacity = useTransform(x, [0, 80], [0, 1])

  const sourceLabel = direction === 'pl-en' ? 'Polish' : 'English'
  const targetLabel = direction === 'pl-en' ? 'English' : 'Polish'

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
    setSwapAngle(a => a + 180)
    setDirection(nextDir)
    // Move the current translation output back into the input
    if (result?.translation) {
      setInput(result.translation)
    } else if (!input) {
      setInput('')
    }
    setResult(null)
    setPhase('idle')
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  function handleAdd() {
    if (!result) return
    onAddCard(buildEntry(result.lemma, result.canonicalEn, result.type, result.gender))
    setAdded(true)
  }

  function handleDragEnd(_: unknown, info: { offset: { x: number }; velocity: { x: number } }) {
    const committed = info.offset.x > window.innerWidth * 0.30 || info.velocity.x > 400
    if (committed && canSwipe) {
      animate(x, 700, { duration: 0.25 })
      setTimeout(() => { x.set(0); handleAdd() }, 270)
    } else {
      animate(x, 0, { type: 'spring', stiffness: 300, damping: 25 })
    }
  }

  const alreadySaved = result?.isSingleWord ? !!findByLemma(result.lemma) : false
  const canSwipe = !!(result?.isSingleWord && !added && !alreadySaved)

  return (
    <div className="fixed inset-0 flex flex-col">

      {/* ── Top section: source language ───────────────────────── */}
      <div className="relative flex flex-[53] flex-col justify-end px-6 pb-7">
        <p className="mb-2 font-instrument text-[14px] font-medium text-white/50">
          {sourceLabel}
        </p>

        {/* Glass textarea */}
        <div className="relative rounded-[20px] shadow-[0_8px_32px_rgba(0,0,0,0.25),inset_0_0_0_1px_rgba(255,255,255,0.10)]">
          <GlassPane borderRadius={20} className="absolute inset-0 rounded-[20px] bg-white/[0.03]" />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => { setInput(e.target.value); if (phase === 'error') setPhase('idle') }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTranslate() } }}
            placeholder="Translate text…"
            rows={3}
            className="relative z-10 w-full resize-none bg-transparent px-5 py-4 font-instrument text-[17px] text-white/90 placeholder:text-white/30 outline-none"
          />
        </div>

        {/* Translate button */}
        <button
          onClick={handleTranslate}
          disabled={!input.trim() || phase === 'loading'}
          className="mt-3 w-full rounded-[14px] border border-white/10 bg-white/[0.05] py-3 font-instrument text-[15px] font-medium text-white/65 transition-all hover:bg-white/[0.09] disabled:pointer-events-none disabled:opacity-30"
        >
          {phase === 'loading' ? 'Translating…' : 'Translate'}
        </button>

        {phase === 'error' && (
          <p className="mt-2 text-center font-instrument text-[12px] text-red-400/70">
            Translation unavailable — check your connection
          </p>
        )}
      </div>

      {/* ── Swap button (straddles the boundary) ───────────────── */}
      <div className="relative z-10 flex justify-center" style={{ marginTop: -21, marginBottom: -21 }}>
        <button
          onClick={handleSwap}
          className="flex h-[42px] w-[42px] items-center justify-center rounded-full border border-white/10 bg-[#181818] shadow-[0_4px_20px_rgba(0,0,0,0.6)] transition-colors hover:bg-[#222]"
        >
          <motion.span
            className="material-symbols-rounded text-[20px] text-white/60"
            animate={{ rotate: swapAngle }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
          >
            sync_alt
          </motion.span>
        </button>
      </div>

      {/* ── Bottom section: target language ────────────────────── */}
      <div className="relative flex flex-[47] flex-col bg-[#080808] px-6 pt-8 pb-[100px] overflow-y-auto no-scrollbar">
        <p className="mb-4 font-instrument text-[14px] font-medium text-white/50">
          {targetLabel}
        </p>

        {phase === 'done' && result && (
          <>
            <motion.div
              style={{ x }}
              drag={canSwipe ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0.08, right: 0.8 }}
              onDragEnd={canSwipe ? handleDragEnd : undefined}
              className={`relative select-none ${canSwipe ? 'cursor-grab active:cursor-grabbing' : ''}`}
            >
              {canSwipe && (
                <motion.div style={{ opacity: addOpacity }}
                  className="pointer-events-none absolute inset-0 z-10 flex items-center justify-end">
                  <span className="font-instrument text-[18px] font-semibold text-emerald-400/90">Add →</span>
                </motion.div>
              )}

              <div className="relative z-20 flex flex-col gap-4">
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

                    {added ? (
                      <p className="font-instrument text-[13px] text-emerald-400/80">Added to vocabulary</p>
                    ) : alreadySaved ? (
                      <p className="font-instrument text-[13px] text-white/30">Already in your vocabulary</p>
                    ) : (
                      <button
                        onClick={handleAdd}
                        className="flex items-center gap-2 self-start font-instrument text-[13px] text-white/45 transition-colors hover:text-white/75"
                      >
                        <span className="material-symbols-rounded text-[17px]">add_circle</span>
                        Add to vocabulary
                      </button>
                    )}
                  </>
                )}
              </div>
            </motion.div>

            {canSwipe && (
              <p className="mt-4 font-instrument text-[11px] text-white/20">swipe right to save</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
