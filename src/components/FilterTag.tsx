import { useRef } from 'react'
import type { WordType } from '../data/types'
import { tagGradients } from '../data/gradients'
import { haptics } from '../lib/haptics'
import GlassPane from './GlassPane'

interface Props {
  id: WordType | 'mastered'
  label: string
  active: boolean
  /** Highlighted "only this" state, set by a long press. A tap on a soloed tag
   *  clears the whole filter bar rather than toggling just itself. */
  soloed?: boolean
  onToggle: () => void
  onLongPress: () => void
}

// Hold duration before the long press fires. Long enough not to catch a slow
// tap, short enough that the tick feels like a response rather than a delay.
const HOLD_MS = 450
// Finger drift that counts as a scroll rather than a hold, in px.
const MOVE_TOLERANCE = 10

export default function FilterTag({ id, label, active, soloed = false, onToggle, onLongPress }: Props) {
  const timer = useRef<number | null>(null)
  const origin = useRef({ x: 0, y: 0 })
  // Set when the hold fires, so the click that touch/mouse release still emits
  // is swallowed instead of also toggling the tag off.
  const fired = useRef(false)

  function cancel() {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }

  function handlePointerDown(e: React.PointerEvent) {
    // Ignore secondary buttons; a right-click shouldn't arm a hold.
    if (e.button !== 0) return
    fired.current = false
    origin.current = { x: e.clientX, y: e.clientY }
    cancel()
    timer.current = window.setTimeout(() => {
      timer.current = null
      fired.current = true
      haptics.doubleTap()
      onLongPress()
    }, HOLD_MS)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (timer.current === null) return
    const dx = e.clientX - origin.current.x
    const dy = e.clientY - origin.current.y
    // The tag row sits in the scrolling page, so a drag is a scroll, not a hold.
    if (dx * dx + dy * dy > MOVE_TOLERANCE * MOVE_TOLERANCE) cancel()
  }

  function handleClick() {
    if (fired.current) {
      fired.current = false
      return
    }
    onToggle()
  }

  return (
    // Outer: gradient border ring, same structure as IconButton
    <button
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      // A hold on Android otherwise raises the text-selection / context menu
      // over the tag and steals the gesture.
      onContextMenu={e => e.preventDefault()}
      style={{ WebkitTouchCallout: 'none' }}
      aria-pressed={active}
      className={`flex select-none rounded-[124px] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
        soloed
          ? 'shadow-[0_4px_20px_rgba(0,0,0,0.35),inset_0_0_0_1.5px_rgba(255,255,255,0.75)]'
          : 'glass-raise-sm'
      }`}
    >
      <GlassPane forceCss borderRadius={62} className="relative flex items-center justify-center rounded-[124px] bg-ink/[0.02] px-3 py-1">
        {active && (
          <div
            className={`absolute inset-0 z-0 flex items-center justify-center mix-blend-screen ${soloed ? 'opacity-100' : 'opacity-80'}`}
            dangerouslySetInnerHTML={{ __html: tagGradients[id] }}
          />
        )}
        <span
          className={`relative z-10 font-instrument text-[10px] transition-colors ${
            soloed ? 'font-medium text-ink' : active ? 'font-normal text-ink' : 'font-normal ink-tertiary'
          }`}
        >
          {label}
        </span>
      </GlassPane>
    </button>
  )
}
