import { useState, useEffect } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import GlassCard from './GlassCard'
import GlassInput from './GlassInput'
import GlassPane from './GlassPane'
import { tagGradients } from '../data/gradients'
import { findByLemma } from '../lib/storage'
import type { VocabEntry, WordType } from '../data/types'

const translateGradient = (
  <svg className="h-full w-full object-cover" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 376 64" fill="none" preserveAspectRatio="none">
    <rect x="21.8" y="21.8" width="332" height="26" rx="13" fill="#016670" filter="blur(10.9px)" />
    <rect x="30.5883" y="29.5449" width="314.424" height="18.2553" rx="9.12766" fill="#09B8C9" filter="blur(10.9px)" />
    <rect x="73.553" y="31.7576" width="264.624" height="13.8298" rx="6.91489" fill="#5BDFDF" filter="blur(10.9px)" />
  </svg>
)

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

export default function TranslatePage({ onAddCard }: Props) {
  const [input, setInput] = useState('')
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<Result | null>(null)
  const [added, setAdded] = useState(false)

  const x = useMotionValue(0)
  const addOpacity = useTransform(x, [0, 80], [0, 1])

  // Reset card position whenever a new result arrives
  useEffect(() => { x.set(0) }, [result, x])

  const isSingleWord = (text: string) => {
    const words = text.trim().split(/\s+/)
    // Reflexive verbs ("stać się", "cieszyć się", …) are a single lexical unit
    return words.length === 1 || (words.length === 2 && words[1].toLowerCase() === 'się')
  }

  async function handleTranslate() {
    const text = input.trim()
    if (!text || phase === 'loading') return
    setPhase('loading')
    setResult(null)
    setAdded(false)

    try {
      const single = isSingleWord(text)
      const [translateRes, lemmaRes] = await Promise.all([
        fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
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

  function handleAdd() {
    if (!result) return
    onAddCard(buildEntry(result.lemma, result.canonicalEn, result.type, result.gender))
    setAdded(true)
  }

  const alreadySaved = result?.isSingleWord ? !!findByLemma(result.lemma) : false
  const canSwipe = !!(result?.isSingleWord && !added && !alreadySaved)

  function handleDragEnd(_: unknown, info: { offset: { x: number }; velocity: { x: number } }) {
    const committed = info.offset.x > window.innerWidth * 0.30 || info.velocity.x > 400
    if (committed && canSwipe) {
      animate(x, 700, { duration: 0.25 })
      setTimeout(() => {
        x.set(0)
        handleAdd()
      }, 270)
    } else {
      animate(x, 0, { type: 'spring', stiffness: 300, damping: 25 })
    }
  }

  return (
    <div className="animate-fade-in flex w-full flex-col gap-6 pt-[24px]">
      <GlassCard contentClassName="flex flex-col p-[20px]">
        <GlassInput
          placeholder="Enter a Polish word or phrase…"
          icon="translate"
          value={input}
          onChange={v => { setInput(v); if (phase === 'error') setPhase('idle') }}
          onKeyDown={e => { if (e.key === 'Enter') handleTranslate() }}
          className="mb-4"
        />
        <button
          onClick={handleTranslate}
          disabled={!input.trim() || phase === 'loading'}
          className="relative flex h-[50px] w-full items-center justify-center overflow-hidden rounded-full border border-[#F8FAFC]/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_4px_12px_rgba(0,0,0,0.2)] transition-all hover:scale-[1.02] active:scale-[0.98] group disabled:pointer-events-none disabled:opacity-40"
        >
          <div className="absolute inset-0 z-0 rounded-full bg-[#F8FAFC]/5 transition-colors group-hover:bg-[#F8FAFC]/10" />
          <div className="absolute inset-0 z-10 flex items-center justify-center opacity-90 mix-blend-screen">
            {translateGradient}
          </div>
          <span className="relative z-20 font-instrument text-[16px] font-semibold text-[#F8FAFC]">
            {phase === 'loading' ? 'Translating…' : 'Translate'}
          </span>
        </button>

        {phase === 'error' && (
          <p className="mt-3 text-center font-instrument text-[13px] text-red-400/80">
            Translation unavailable — check your connection
          </p>
        )}
      </GlassCard>

      {phase === 'done' && result && (
        <>
        <motion.div
          style={{ x }}
          drag={canSwipe ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={{ left: 0.08, right: 0.8 }}
          onDragEnd={canSwipe ? handleDragEnd : undefined}
          className={`w-full rounded-[36px] shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_0_0_1px_rgba(255,255,255,0.12)] select-none ${canSwipe ? 'cursor-grab active:cursor-grabbing' : ''}`}
        >
          <div className="relative flex w-full flex-col rounded-[36px] p-[24px]">
            <GlassPane borderRadius={36} className="absolute inset-0 z-0 rounded-[36px] bg-white/[0.02]" />

            {/* Swipe-to-add overlay */}
            {canSwipe && (
              <motion.div style={{ opacity: addOpacity }}
                className="pointer-events-none absolute inset-0 z-10 flex items-center justify-end rounded-[36px] pr-8">
                <span className="font-instrument text-[20px] font-semibold text-emerald-400/90">Add →</span>
              </motion.div>
            )}

            <div className="relative z-20 flex flex-col gap-4">

              {/* Translation */}
              <p className="font-instrument text-[30px] italic leading-tight text-[#B4A0FF]">
                {result.translation}
              </p>

              {result.isSingleWord && (
                <>
                  <div className="h-[1px] w-full bg-white/10" />

                  {/* Lemma + type */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <span className="font-instrument text-[20px] font-medium text-white/80">
                        {result.lemma}
                      </span>
                      {result.gender && (
                        <span className="font-instrument text-[16px] italic text-[#e879f9]">
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
                      <span className="font-instrument text-[14px] text-white/40">{result.canonicalEn}</span>
                    )}
                  </div>

                  {/* Add to vocab */}
                  {added ? (
                    <p className="font-instrument text-[14px] text-emerald-400/80">Added to vocabulary</p>
                  ) : alreadySaved ? (
                    <p className="font-instrument text-[14px] text-white/30">Already in your vocabulary</p>
                  ) : (
                    <button
                      onClick={handleAdd}
                      className="flex items-center gap-2 self-start font-instrument text-[14px] text-white/50 transition-colors hover:text-white/80"
                    >
                      <span className="material-symbols-rounded text-[18px]">add_circle</span>
                      Add to vocabulary
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </motion.div>

        {canSwipe && (
          <p className="text-center font-instrument text-[12px] text-white/20">swipe right to save</p>
        )}
        </>
      )}
    </div>
  )
}
