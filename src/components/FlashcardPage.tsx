import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, useMotionValueEvent, animate, type MotionValue } from 'framer-motion'
import { tagGradients } from '../data/gradients'
import { type VocabEntry, typeLabel } from '../data/types'
import { getAllReviews, getReview, saveReview, initReview, replaceAllReviews } from '../lib/reviewStorage'
import { applyEasy, applyHard, applyConquered, applyLapse, isConquered } from '../lib/scheduler'
import { setAnchor } from './tour/anchors'
import type { PageId } from '../data/types'
import { useTTS, type AudioState } from '../lib/useTTS'
import { pokeRenderer, setBgHardMode } from '../webgl/glassStore'
import GlassPane from './GlassPane'
import GlassButton from './GlassButton'
import IconButton from './IconButton'
import HardModeToggle from './HardModeToggle'
import ProgressBar from './ProgressBar'
import { useDoubleTap } from '../hooks/useDoubleTap'
import { useBackClose } from '../hooks/useBackClose'
import { haptics } from '../lib/haptics'
import FlashcardGroupSelector from './FlashcardGroupSelector'
import { scoreRight, scoreLeft, AGAIN_SCORE, type GroupStat } from '../lib/flashcardGroups'

// ─── Drag threshold (fraction of card width) ──────────────────────────────────

const THRESHOLD = 0.30
// conquerProgress needed to unlock the swipe-up-hold conquer gesture.
const CONQUER_THRESHOLD = 3
// Swipe-up-hold conquer gesture tuning.
const CONQUER_UP_START = 64   // px dragged up to begin charging
const CONQUER_UP_KEEP  = 28   // if the card drops back below this, cancel
const CONQUER_HOLD_MS  = 2200 // hold this long (trembling) to conquer
// Twinkling sparkles along the top of a conquerable card — an affordance that
// it can be swiped up. { left%, top px offset, size px, anim delay, colour }.
const CONQUER_SPARKLES = [
  { left: '14%', top: -4,  size: 15, delay: 0.0,  color: '#B4A0FF' },
  { left: '31%', top: -13, size: 11, delay: 0.6,  color: '#FFE0A0' },
  { left: '50%', top: -8,  size: 19, delay: 1.0,  color: '#B4A0FF' },
  { left: '69%', top: -13, size: 11, delay: 0.35, color: '#FFE0A0' },
  { left: '86%', top: -4,  size: 15, delay: 0.8,  color: '#B4A0FF' },
]

// ─── Flashcard UI ─────────────────────────────────────────────────────────────

interface CardProps {
  entry: VocabEntry
  x: MotionValue<number>
  hardMode: boolean
  conquerable: boolean
  onToggleHardMode: () => void
  onEasy: () => void
  onHard: () => void
  onConquered: () => void
  onLapse: () => void
  isConquering: boolean
  revealed: boolean
  onReveal: () => void
  ttsState: AudioState
  onReplay: () => void
  onOpenModal?: (entry: VocabEntry) => void
}

function FlashCard({ entry, x, hardMode, conquerable, onToggleHardMode, onEasy, onHard, onConquered, onLapse, isConquering, revealed, onReveal, ttsState, onReplay, onOpenModal }: CardProps) {
  const rotate = useTransform(x, [-300, 0, 300], [-18, 0, 18])
  const doubleTap = useDoubleTap(useCallback(() => { onOpenModal?.(entry) }, [onOpenModal, entry]))

  const cardRef = useRef<HTMLDivElement | null>(null)
  const rotationJustFired = useRef(false)
  const rotateYVal = useMotionValue(0)

  // Swipe-up-hold-to-conquer state (only active when `conquerable`).
  const y = useMotionValue(0)
  const trembleX = useMotionValue(0)   // added on the inner wrapper
  const trembleR = useMotionValue(0)
  const chargeGlow = useMotionValue(0) // 0..1 glow opacity while holding
  const [isCharging, setIsCharging] = useState(false)
  const chargingRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const chargeStartRef = useRef(0)
  const lastHapticRef = useRef(0)
  useEffect(() => stopChargeLoop, [])   // stop the charge rAF if the card unmounts mid-hold
  // On conquer, fling the card up and off-screen so it visibly "swipes up"
  // instead of resetting to centre. Driven by isConquering so it fires for both
  // the swipe-up-hold gesture and the Conquered button.
  useEffect(() => {
    if (isConquering) animate(y, -Math.round(window.innerHeight * 1.1), { duration: 0.5, ease: 'easeIn' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConquering])
  // Lags behind hardMode by one animation cycle so content swaps at the midpoint
  const [displayHardMode, setDisplayHardMode] = useState(hardMode)

  // Fold-swap-unfold when hardMode prop changes
  useEffect(() => {
    if (displayHardMode === hardMode) return
    animate(rotateYVal, 90, {
      duration: 0.18,
      ease: 'easeIn',
      onComplete: () => {
        setDisplayHardMode(hardMode)
        rotateYVal.set(-90)
        animate(rotateYVal, 0, { duration: 0.18, ease: 'easeOut' })
      },
    })
  }, [hardMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Two-finger rotation gesture — native listeners required for passive:false
  useEffect(() => {
    const el = cardRef.current
    if (!el) return

    let startAngle: number | null = null
    let startX: number | null = null
    let committed = false

    const getAngle = (t: TouchList) =>
      Math.atan2(t[1].clientY - t[0].clientY, t[1].clientX - t[0].clientX) * (180 / Math.PI)
    const getX = (t: TouchList) => (t[0].clientX + t[1].clientX) / 2

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return
      startAngle = getAngle(e.touches)
      startX = getX(e.touches)
      committed = false
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || startAngle === null || startX === null || committed) return
      e.preventDefault()
      // A horizontal drag of the two fingers isn't a rotation intent — bail
      // so this doesn't fight the swipe-to-rate gesture.
      if (Math.abs(getX(e.touches) - startX) > 20) return
      const delta = getAngle(e.touches) - startAngle
      const norm = ((delta + 180) % 360) - 180
      if (Math.abs(norm) > 45) {
        committed = true
        rotationJustFired.current = true
        // Reset the guard on a timer HERE, not in onTouchEnd: onToggleHardMode
        // re-renders and tears down/recreates these listeners mid-gesture, so
        // the onTouchEnd closure that used to schedule this may never run —
        // which left the guard stuck true and the card permanently unclickable.
        // This timeout references the stable ref, so it survives the remount.
        setTimeout(() => { rotationJustFired.current = false }, 600)
        haptics.swipeRight()
        onToggleHardMode()
      }
    }

    const onTouchEnd = () => {
      startAngle = null
      startX = null
      committed = false
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [onToggleHardMode])

  // ─── Swipe-up-hold to conquer ─────────────────────────────────────────────
  function stopChargeLoop() {
    if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
  }
  function startCharge() {
    if (chargingRef.current) return
    chargingRef.current = true
    setIsCharging(true)
    chargeStartRef.current = performance.now()
    lastHapticRef.current = 0
    const loop = () => {
      if (!chargingRef.current) return
      const p = Math.min(1, (performance.now() - chargeStartRef.current) / CONQUER_HOLD_MS)
      chargeGlow.set(p)
      // Tremble grows with the hold.
      trembleX.set((Math.random() * 2 - 1) * 8 * p)
      trembleR.set((Math.random() * 2 - 1) * 4 * p)
      // Haptics escalate: lighter/slower → heavier/faster as it builds.
      const interval = 220 - 150 * p
      if (performance.now() - lastHapticRef.current >= interval) {
        lastHapticRef.current = performance.now()
        if (p < 0.4) haptics.tap()
        else if (p < 0.78) haptics.doubleTap()
        else haptics.swipeLeft()
      }
      if (p >= 1) { completeCharge(); return }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }
  function cancelCharge() {
    if (!chargingRef.current) return
    chargingRef.current = false
    setIsCharging(false)
    stopChargeLoop()
    animate(chargeGlow, 0, { duration: 0.25 })
    animate(trembleX, 0, { duration: 0.2 })
    animate(trembleR, 0, { duration: 0.2 })
  }
  function completeCharge() {
    chargingRef.current = false
    setIsCharging(false)
    stopChargeLoop()
    chargeGlow.set(0)
    trembleX.set(0); trembleR.set(0)
    // Don't spring back to centre — the isConquering effect flings the card up.
    onConquered()
  }

  function handleDrag(_: unknown, info: { offset: { x: number; y: number } }) {
    if (!conquerable || isConquering) return
    const upDominant = info.offset.y < -CONQUER_UP_START && Math.abs(info.offset.y) > Math.abs(info.offset.x)
    if (upDominant) { if (!chargingRef.current) startCharge() }
    else if (chargingRef.current && info.offset.y > -CONQUER_UP_KEEP) cancelCharge()
  }

  function handleDragEnd(_: unknown, info: { offset: { x: number; y: number }; velocity: { x: number } }) {
    // Conquer charge in progress but finger lifted before completion → cancel.
    if (chargingRef.current) { cancelCharge(); animate(y, 0, { type: 'spring', stiffness: 300, damping: 25 }); return }
    // A vertical drag that never reached the charge threshold → spring back.
    if (Math.abs(info.offset.y) > Math.abs(info.offset.x)) { animate(y, 0, { type: 'spring', stiffness: 300, damping: 25 }); return }
    // Horizontal swipe → easy (right) / hard (left).
    const cardWidth = window.innerWidth * 0.82
    const committed = Math.abs(info.offset.x) > cardWidth * THRESHOLD || Math.abs(info.velocity.x) > 400
    if (committed && info.offset.x > 0) {
      haptics.swipeRight()
      animate(x, 600, { duration: 0.25 })
      setTimeout(onEasy, 220)
    } else if (committed && info.offset.x < 0) {
      haptics.swipeLeft()
      animate(x, -600, { duration: 0.25 })
      setTimeout(onHard, 220)
    } else {
      animate(x, 0, { type: 'spring', stiffness: 300, damping: 25 })
    }
  }

  return (
    <motion.div
      ref={el => { cardRef.current = el; setAnchor('fc-card')(el) }}
      style={{ x, y, rotate, perspective: '1200px' }}
      drag={revealed ? true : false}
      dragDirectionLock
      // Up is always draggable so the gesture is discoverable, but only a
      // conquerable card gets real upward range (top:-170) to hold & charge.
      // Otherwise top:0 means an up-drag is pure rubber-band (firmer top elastic)
      // that springs back — a clear "you can swipe up, but not yet" signal.
      dragConstraints={{ left: 0, right: 0, top: conquerable ? -170 : 0, bottom: 0 }}
      dragElastic={{ top: conquerable ? 0.8 : 0.4, bottom: 0.2, left: 0.8, right: 0.8 }}
      onDrag={revealed ? handleDrag : undefined}
      onDragEnd={revealed ? handleDragEnd : undefined}
      onTouchEnd={e => { if (rotationJustFired.current) return; doubleTap.onTouchEnd(e) }}
      onClick={e => { if (rotationJustFired.current) return; doubleTap.onClick(e); if (!revealed) onReveal() }}
      className={`relative w-full select-none ${revealed ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
      animate={isConquering ? { scale: [1, 1.04, 1], transition: { duration: 0.4 } } : {}}
    >
      {/* Conquered glow ring — sits outside the flipping element so it doesn't rotate */}
      {isConquering && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-[36px]"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: [0, 0.8, 0], scale: [0.95, 1.06, 1.12], transition: { duration: 0.5 } }}
          style={{ boxShadow: '0 0 0 3px rgba(180,160,255,0.9), 0 0 40px 8px rgba(180,160,255,0.5)' }}
        />
      )}

      {/* Charge glow that builds while holding the card up to conquer */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-30 rounded-[36px]"
        style={{ opacity: chargeGlow, boxShadow: '0 0 0 2px rgba(180,160,255,0.9), 0 0 44px 10px rgba(180,160,255,0.55)' }}
      />

      {/* Sparkle crown along the top edge — signals the card can be swiped up */}
      {conquerable && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30">
          {CONQUER_SPARKLES.map((s, i) => (
            <motion.span
              key={i}
              className="material-symbols-rounded absolute -translate-x-1/2"
              style={{ left: s.left, top: s.top, fontSize: s.size, color: s.color, filter: 'drop-shadow(0 0 4px currentColor)' }}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: [0, 1, 0], scale: [0.4, 1, 0.4], rotate: [0, 25, 0] }}
              transition={{ duration: 1.9, delay: s.delay, repeat: Infinity, repeatDelay: 0.5, ease: 'easeInOut' }}
            >
              auto_awesome
            </motion.span>
          ))}
        </div>
      )}

      {/* Hint: card is conquerable — swipe up and hold */}
      {conquerable && revealed && !isCharging && (
        <motion.div
          className="pointer-events-none absolute -top-9 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, -4, 0] }}
          transition={{ y: { repeat: Infinity, duration: 1.4 }, opacity: { duration: 0.3 } }}
        >
          <span className="material-symbols-rounded text-[18px] text-accent">keyboard_double_arrow_up</span>
          <span className="font-instrument text-[12px] font-medium text-accent/80">hold up to conquer</span>
        </motion.div>
      )}

      {/* Inner wrapper that rotates on hard-mode toggle; also carries the
          conquer tremble (x jitter + rotateZ) so it stacks on the drag. */}
      <motion.div style={{ rotateY: rotateYVal, x: trembleX, rotate: trembleR }}>
        <div className="relative rounded-[36px] shadow-[0_8px_48px_rgba(0,0,0,0.4),inset_0_0_0_1px_rgba(255,255,255,0.12)]">
          <GlassPane borderRadius={36} rotation={rotate} className="absolute inset-0 z-0 rounded-[36px] bg-ink/[0.02]" />

          <div className="relative z-20 flex flex-col items-center gap-6 px-8 py-10">
            {/* Type badge + hard mode label */}
            <div className="flex items-center gap-2">
              <div className="relative flex items-center justify-center overflow-hidden rounded-[124px] border border-ink/20 bg-ink/10 px-3.5 py-[5px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]">
                <div
                  className="absolute inset-0 z-0 flex items-center justify-center opacity-70 mix-blend-screen"
                  dangerouslySetInnerHTML={{ __html: tagGradients[entry.type] ?? tagGradients['unknown'] }}
                />
                <span className="relative z-10 font-instrument text-[12px] font-medium capitalize text-ink">
                  {typeLabel(entry.type)}
                </span>
              </div>
              {displayHardMode && (
                <span className="font-instrument text-[11px] font-medium text-accent/80">hard</span>
              )}
            </div>

            {/* Question word — pl in normal mode, en in hard mode */}
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 lang={displayHardMode ? 'en' : 'pl'} className="hyphens-auto break-words font-instrument text-[48px] font-bold leading-none tracking-tight text-ink">
                {displayHardMode ? entry.en : entry.pl}
              </h1>
              {!displayHardMode && entry.type === 'noun' && entry.gender && (
                <span className="font-instrument text-[22px] italic " style={{ color: 'var(--aspect)' }}>{entry.gender}</span>
              )}
              {!displayHardMode && entry.type === 'verb' && entry.left && (
                <span className="font-instrument text-[22px] italic " style={{ color: 'var(--aspect)' }}>{entry.left}</span>
              )}
            </div>

            {/* Reveal area */}
            <AnimatePresence mode="wait">
              {!revealed ? (
                <motion.div
                  key="hint"
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  className="flex w-full flex-col items-center gap-3"
                >
                  <div className="h-[1px] w-full bg-ink/10" />
                  <p className="font-instrument text-[14px] ink-tertiary">tap to reveal</p>
                </motion.div>
              ) : (
                <motion.div
                  key="translation"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex w-full flex-col items-center gap-3"
                >
                  <div className="h-[1px] w-full bg-ink/10" />
                  <div className="flex w-full items-center justify-between gap-3">
                    {displayHardMode ? (
                      <div className="flex flex-col gap-1">
                        <p className="font-instrument text-[24px] font-medium text-accent">{entry.pl}</p>
                        {entry.type === 'noun' && entry.gender && (
                          <span className="font-instrument text-[18px] italic " style={{ color: 'var(--aspect)' }}>{entry.gender}</span>
                        )}
                        {entry.type === 'verb' && entry.left && (
                          <span className="font-instrument text-[18px] italic " style={{ color: 'var(--aspect)' }}>{entry.left}</span>
                        )}
                      </div>
                    ) : (
                      <p className="font-instrument text-[24px] font-medium text-accent">{entry.en}</p>
                    )}
                    <GlassButton
                      onClick={e => { e.stopPropagation(); onReplay() }}
                      radius={16}
                      pane="bg-ink/5"
                      className={`h-[32px] w-[32px] flex-shrink-0 border border-ink/10 ${ttsState === 'error' ? 'text-red-400/70' : 'ink-tertiary hover:text-ink/70'}`}
                    >
                      <span className={`material-symbols-rounded text-[16px]${ttsState === 'playing' ? ' animate-pulse' : ''}`}>
                        {ttsState === 'loading' ? 'progress_activity' : ttsState === 'error' ? 'error' : 'volume_up'}
                      </span>
                    </GlassButton>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Mastery badge ─────────────────────────────────────────────────────────────

// Small persistent badge (top-right of the page) showing how many cards have
// been permanently mastered/conquered. The progress bar now tracks the current
// run instead, so this keeps lifetime mastery visible at a glance.
function MasteryBadge({ count }: { count: number }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-ink/[0.04] px-2.5 py-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]">
      <span className="material-symbols-rounded text-[15px] text-accent/80">military_tech</span>
      <span className="font-instrument text-[12px] font-medium tabular-nums ink-tertiary">
        {count} mastered
      </span>
    </div>
  )
}

// ─── Run-complete state ────────────────────────────────────────────────────────

// Shown once every playable card in the current scope has been rated. `reviewed`
// is 0 only when the scope was already fully mastered (nothing to drill).
function RunComplete({ reviewed, onRestart, onBack }: { reviewed: number; onRestart: () => void; onBack: () => void }) {
  const empty = reviewed === 0
  return (
    <div className="flex flex-col items-center gap-4 pt-16 text-center">
      <span className="material-symbols-rounded text-[56px] text-accent/60">{empty ? 'military_tech' : 'task_alt'}</span>
      <h2 className="font-instrument text-[26px] font-semibold text-ink/80">{empty ? 'All mastered here' : 'Run complete!'}</h2>
      <p className="font-instrument text-[16px] ink-tertiary">
        {empty ? 'Every card in this group is already mastered.' : `You reviewed all ${reviewed} cards this round.`}
      </p>
      <div className="mt-2 flex flex-col items-stretch gap-3">
        {!empty && (
          <GlassButton variant="primary" onClick={onRestart} className="px-6 py-3 font-instrument text-[15px]">
            <span className="material-symbols-rounded text-[18px]">replay</span>
            Go again
          </GlassButton>
        )}
        <GlassButton variant="secondary" onClick={onBack} className="px-6 py-3 font-instrument text-[15px]">
          <span className="material-symbols-rounded text-[18px]">grid_view</span>
          Back to groups
        </GlassButton>
      </div>
    </div>
  )
}

// ─── Action buttons ───────────────────────────────────────────────────────────

function ActionButtons({ conquerable, onConquered, onLapse }: { conquerable: boolean; onConquered: () => void; onLapse: () => void }) {
  return (
    <div className="flex w-full gap-3">
      <GlassButton
        variant="danger"
        onClick={onLapse}
        className="flex-1 py-4 font-instrument text-[15px]"
      >
        <span className="material-symbols-rounded text-[18px]">replay</span>
        Again
      </GlassButton>
      {/* Conquered is only offered once the card is conquerable (earned via
          right-swipes) — the primary way to conquer is the swipe-up-hold. */}
      {conquerable && (
        <GlassButton
          variant="primary"
          onClick={onConquered}
          className="flex-1 py-4 font-instrument text-[15px]"
        >
          <span className="material-symbols-rounded text-[18px]">military_tech</span>
          Conquered
        </GlassButton>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface Props {
  cards: VocabEntry[]
  onOpenModal?: (entry: VocabEntry) => void
  /** Empty state only: where to send someone with no words yet. */
  onChangePage: (id: PageId) => void
  /** Tells the flashcards tour what the user just did. */
  onTourEvent?: (e: 'fc-started' | 'fc-revealed' | 'fc-swiped') => void
}

export default function FlashcardPage({ cards, onOpenModal, onChangePage, onTourEvent }: Props) {
  // Overview-first: the game opens on the group selector, then plays a chosen
  // scope (a group, or all cards).
  const [screen, setScreen] = useState<'selector' | 'playing'>('selector')
  const [scopeCards, setScopeCards] = useState<VocabEntry[]>([])
  const [scopeLabel, setScopeLabel] = useState('')
  const [queue, setQueue] = useState<VocabEntry[]>([])
  const [isConquering, setIsConquering] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [hardMode, setHardMode] = useState(false)
  // Session progress: the distinct cards rated (swiped left/right or conquered —
  // NOT "Again") during the current run, plus the run's card count. Restarting a
  // run clears both. This drives the top progress bar.
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set())
  const [runTotal, setRunTotal] = useState(0)
  const tts = useTTS()
  const x = useMotionValue(0)
  const leftOpacity  = useTransform(x, [-100, 0], [1, 0])
  const rightOpacity = useTransform(x, [0, 100],  [0, 1])
  // Keep the WebGL glass tracking the card while it's dragged/flung, so its
  // glass doesn't lag behind and render as a ghost card.
  useMotionValueEvent(x, 'change', pokeRenderer)

  // Recolour the page background to crimson while in hard mode; clear it when
  // leaving the flashcard page. Read by both renderers: the shader via
  // resolvePageUniforms, the DOM layers via PageGradient.
  useEffect(() => { setBgHardMode(hardMode) }, [hardMode])
  useEffect(() => () => setBgHardMode(false), [])

  // Build a shuffled deck of the not-yet-conquered cards in a subset. Conquered
  // cards are excluded from play (there's no reason to re-drill mastered words);
  // they still count toward a group's progress in the selector.
  function deckFrom(subset: VocabEntry[]): VocabEntry[] {
    const reviews = getAllReviews()
    const pool = subset.filter(c => { const r = reviews[c.id]; return !r || !isConquered(r) })
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]] }
    return pool
  }

  // Start a run over a chosen scope (a group, or all cards) and switch to play.
  const startRunFor = useCallback((subset: VocabEntry[], label: string) => {
    onTourEvent?.('fc-started')
    setScopeCards(subset)
    setScopeLabel(label)
    const deck = deckFrom(subset)
    setQueue(deck)
    setRunTotal(deck.length)
    setReviewedIds(new Set())
    setRevealed(false)
    setScreen('playing')
  }, [onTourEvent])

  // Restart the current scope (the "Go again" action on the run-complete screen).
  const restart = useCallback(() => {
    const deck = deckFrom(scopeCards)
    setQueue(deck)
    setRunTotal(deck.length)
    setReviewedIds(new Set())
    setRevealed(false)
  }, [scopeCards])

  // Android back while playing → back to the group selector; on the selector it
  // falls through to App's tab-level handler (→ vocab list).
  useBackClose(screen === 'playing', () => { tts.stop(); setScreen('selector') })

  const markReviewed = useCallback((id: string) => {
    setReviewedIds(prev => (prev.has(id) ? prev : new Set(prev).add(id)))
  }, [])

  // Mastery (conquered / total) — persistent; shown as the top-right badge and
  // fed to the selector for per-group stats.
  const reviews = getAllReviews()
  const conqueredCount = cards.filter(c => { const r = reviews[c.id]; return r && isConquered(r) }).length

  const current = queue[0] ?? null
  // A card unlocks the swipe-up-hold conquer gesture once it's been right-swiped
  // (marked easy) enough (3 normal / 2 hard, tracked in review state) — you
  // conquer what you know. A hard-swipe or "Again" resets that progress.
  const conquerable = current ? (reviews[current.id]?.conquerProgress ?? 0) >= CONQUER_THRESHOLD : false

  // Pre-fetch both audio clips while the question side is visible so playback starts instantly on reveal
  useEffect(() => {
    if (current) tts.prefetch(current.pl, current.en)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id])

  // Advance past a rated card: the queue simply shrinks. When it empties the run
  // is complete (render shows "Go again"). Marking a card reviewed happens in the
  // rating handlers, so "Again" (a lapse, which requeues) never counts.
  const advance = useCallback(() => {
    tts.stop()
    animate(x, 0, { duration: 0 })
    setQueue(q => q.slice(1))
    setRevealed(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Move current card to position ~3 in queue so it comes back soon in this session
  const requeueCurrent = useCallback(() => {
    tts.stop()
    animate(x, 0, { duration: 0 })
    setQueue(q => {
      if (q.length <= 1) return q  // only card left — stays at front, re-revealed
      const [head, ...tail] = q
      const pos = Math.min(3, tail.length)
      return [...tail.slice(0, pos), head, ...tail.slice(pos)]
    })
    setRevealed(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleReveal() {
    if (!current) return
    onTourEvent?.('fc-revealed')
    setRevealed(true)
    tts.playSequence(current.pl, current.en)
  }

  function handleToggleHardMode() {
    setHardMode(h => !h)
    setRevealed(false)
  }

  function handleResetMastery() {
    // Un-conquer every card (reset interval + score) so the whole deck can be
    // replayed, then return to the selector to re-pick a scope.
    const all = getAllReviews()
    for (const id of Object.keys(all)) {
      if (isConquered(all[id])) all[id] = { ...all[id], conquered: false, interval: 1, conquerProgress: 0 }
    }
    replaceAllReviews(all)
    setScreen('selector')
  }

  function getOrInit(id: string) {
    return getReview(id) ?? initReview(id)
  }

  function handleEasy() {
    onTourEvent?.('fc-swiped')
    if (!current) return
    markReviewed(current.id)
    // Got it easily (right-swipe) → +1 strength AND advance toward conquerable:
    // you unlock the conquer gesture by knowing a card, not by struggling with it.
    // Hard mode counts 1.5, so 2 right-swipes in hard mode reach the same 3 as
    // 3 normal ones.
    const st = getOrInit(current.id)
    const conquerProgress = (st.conquerProgress ?? 0) + (hardMode ? 1.5 : 1)
    saveReview(current.id, { ...applyEasy(st), conquerProgress, strengthScore: scoreRight(st.strengthScore ?? 0) })
    advance()
  }

  function handleHard() {
    onTourEvent?.('fc-swiped')
    if (!current) return
    markReviewed(current.id)
    // Struggled (left-swipe) → schedule as hard and reset conquer progress: a miss
    // means the card isn't mastered yet. Strength also drops (0, or −1 deeper if
    // already negative).
    const st = getOrInit(current.id)
    saveReview(current.id, { ...applyHard(st), conquerProgress: 0, strengthScore: scoreLeft(st.strengthScore ?? 0) })
    advance()
  }

  function handleConquered() {
    if (!current) return
    markReviewed(current.id)
    haptics.conquered()
    saveReview(current.id, { ...applyConquered(getOrInit(current.id)), conquerProgress: 0 })
    setIsConquering(true)
    // Let the card fling up (~0.5s) and hold a beat before the next card appears.
    setTimeout(() => {
      setIsConquering(false)
      advance()
    }, 780)
  }

  function handleLapse() {
    if (!current) return
    haptics.repeat()
    // "Again" → reset conquer progress (a clear miss) and drop strength into the
    // −3 hole to climb back out of.
    saveReview(current.id, { ...applyLapse(getOrInit(current.id)), conquerProgress: 0, strengthScore: AGAIN_SCORE })
    requeueCurrent()
  }

  if (screen === 'selector') {
    return (
      <FlashcardGroupSelector
        cards={cards}
        conqueredCount={conqueredCount}
        hardMode={hardMode}
        onToggleHardMode={handleToggleHardMode}
        onResetMastery={handleResetMastery}
        onPlayAll={() => startRunFor(cards, 'All cards')}
        onPlayGroup={(g: GroupStat) => startRunFor(g.cards, `Words ${g.start}–${g.end}`)}
        onChangePage={onChangePage}
      />
    )
  }

  return (
    <>
      {/* Swipe feedback glows — focal raised to ~40% so they align with the
          card (which sits above the viewport center) rather than mid-screen. */}
      <motion.div className="pointer-events-none fixed inset-0" style={{ opacity: leftOpacity, background: 'radial-gradient(ellipse at left 40%, rgba(222,0,4,0.85) 0%, transparent 65%)' }} />
      <motion.div className="pointer-events-none fixed inset-0" style={{ opacity: rightOpacity, background: 'radial-gradient(ellipse at right 40%, rgba(39,209,178,0.85) 0%, transparent 65%)' }} />
    {/* Fill the content area so the card can center vertically; the progress
        bar is lifted into the (empty on this page) header clearance to sit near
        the true top, while the safe-area inset in the padding is preserved. */}
    <div className="animate-fade-in flex h-full w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <IconButton icon="arrow_back" onClick={() => { tts.stop(); setScreen('selector') }} />
            <span className="font-instrument text-[13px] ink-tertiary">{scopeLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Explicit hard-mode toggle (the two-finger rotate gesture still works
                too) — flips the prompt to English→Polish. */}
            <HardModeToggle active={hardMode} onToggle={handleToggleHardMode} />
            <MasteryBadge count={conqueredCount} />
          </div>
        </div>
        <ProgressBar done={reviewedIds.size} total={runTotal} />
      </div>

      {current ? (
        // Top-anchored (not centered) so revealing the translation grows the card
        // downward instead of re-centering and pushing it up — the card keeps its
        // position and the answer expands below it.
        <div className="flex flex-1 flex-col items-center gap-6 pt-[8vh]">
          <FlashCard
            key={current.id}
            entry={current}
            x={x}
            hardMode={hardMode}
            conquerable={conquerable}
            onToggleHardMode={handleToggleHardMode}
            onEasy={handleEasy}
            onHard={handleHard}
            onConquered={handleConquered}
            onLapse={handleLapse}
            isConquering={isConquering}
            revealed={revealed}
            onReveal={handleReveal}
            ttsState={tts.state}
            onReplay={() => tts.playSequence(current.pl, current.en)}
            onOpenModal={onOpenModal}
          />
          <AnimatePresence>
            {revealed && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.05 }}
                className="flex w-full flex-col gap-3"
              >
                <ActionButtons conquerable={conquerable} onConquered={handleConquered} onLapse={handleLapse} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <RunComplete reviewed={runTotal} onRestart={restart} onBack={() => { tts.stop(); setScreen('selector') }} />
        </div>
      )}
    </div>
    </>
  )
}
