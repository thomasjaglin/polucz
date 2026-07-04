import { useEffect, useRef } from 'react'
import { motion, useMotionValue, useTransform, useMotionValueEvent, animate } from 'framer-motion'
import { pages, pageOrder } from '../../data/pages'
import { activeSvgMask } from '../../data/gradients'
import GlassPane from '../GlassPane'
import { GLASS_OVERSCAN } from '../../lib/glassParams'
import type { PageId } from '../../data/types'

interface Props {
  activeId: PageId
  onChangePage: (id: PageId) => void
}

// Gooey tab bar: one glass silhouette — a rounded bar with a slightly larger
// circle around the active item, vertically centered and joined to the bar by
// concave neck fillets, so bubble and bar read as a single attached shape.
// The silhouette is recomputed every animation frame while the bubble springs
// between slots, and applied as an inline clip-path on the pane's glass layer.
const SLOT = 56           // per-item width
const PAD = 14            // bar end padding (keeps fillets off the end caps)
const BAR_H = 56
const BAR_R = 24          // bar corner radius
const BUBBLE_R = 32       // active circle radius (pokes 4px past the bar)
const NECK = 10           // fillet radius joining circle and bar
const W = PAD * 2 + SLOT * pageOrder.length
const BOX_H = BUBBLE_R * 2          // container height — silhouette must fit
const Y0 = (BOX_H - BAR_H) / 2      // bar top edge in container coords
const Y1 = Y0 + BAR_H
const CY = BOX_H / 2

const SPRING = { type: 'spring', stiffness: 420, damping: 32 } as const

// Union outline of the bar and the bubble circle at center x = cx, with
// tangent neck fillets (classic metaball construction). Clockwise path.
function gooeyPath(cx: number, off = 0): string {
  const half = BAR_H / 2
  // Fillet circle centers sit NECK px outside the bar edge; tangency to the
  // bubble puts them sqrt((R+f)² − (half+f)²) from cx horizontally.
  const dx = Math.sqrt((BUBBLE_R + NECK) ** 2 - (half + NECK) ** 2)
  const k = BUBBLE_R / (BUBBLE_R + NECK)
  const px = k * dx                    // bubble tangent point, x offset from cx
  const tTop = CY - k * (half + NECK)  // bubble tangent point y (top side)
  const tBot = CY + k * (half + NECK)

  const o = off
  const p = (n: number) => (n + o).toFixed(2)

  return [
    `M ${p(BAR_R)} ${p(Y0)}`,
    `H ${p(cx - dx)}`,
    `A ${NECK} ${NECK} 0 0 0 ${p(cx - px)} ${p(tTop)}`,   // neck up (concave)
    `A ${BUBBLE_R} ${BUBBLE_R} 0 0 1 ${p(cx + px)} ${p(tTop)}`, // over the bubble
    `A ${NECK} ${NECK} 0 0 0 ${p(cx + dx)} ${p(Y0)}`,     // neck down
    `H ${p(W - BAR_R)}`,
    `A ${BAR_R} ${BAR_R} 0 0 1 ${p(W)} ${p(Y0 + BAR_R)}`, // right cap
    `V ${p(Y1 - BAR_R)}`,
    `A ${BAR_R} ${BAR_R} 0 0 1 ${p(W - BAR_R)} ${p(Y1)}`,
    `H ${p(cx + dx)}`,
    `A ${NECK} ${NECK} 0 0 0 ${p(cx + px)} ${p(tBot)}`,   // bottom necks + arc
    `A ${BUBBLE_R} ${BUBBLE_R} 0 0 1 ${p(cx - px)} ${p(tBot)}`,
    `A ${NECK} ${NECK} 0 0 0 ${p(cx - dx)} ${p(Y1)}`,
    `H ${p(BAR_R)}`,
    `A ${BAR_R} ${BAR_R} 0 0 1 ${p(0)} ${p(Y1 - BAR_R)}`, // left cap
    `V ${p(Y0 + BAR_R)}`,
    `A ${BAR_R} ${BAR_R} 0 0 1 ${p(BAR_R)} ${p(Y0)}`,
    'Z',
  ].join(' ')
}

const slotCenter = (i: number) => PAD + SLOT * i + SLOT / 2

export default function BottomNav({ activeId, onChangePage }: Props) {
  const idx = Math.max(0, pageOrder.indexOf(activeId))
  const containerRef = useRef<HTMLDivElement | null>(null)
  const fillRef = useRef<SVGPathElement | null>(null)
  const strokeRef = useRef<SVGPathElement | null>(null)
  const shadowRef = useRef<SVGPathElement | null>(null)

  const cx = useMotionValue(slotCenter(idx))
  const discX = useTransform(cx, v => v - 21) // 42px gradient disc

  function applyShape(v: number) {
    const d = gooeyPath(v)
    containerRef.current?.style.setProperty('--glass-clip', `path('${gooeyPath(v, GLASS_OVERSCAN)}')`)
    fillRef.current?.setAttribute('d', d)
    strokeRef.current?.setAttribute('d', d)
    shadowRef.current?.setAttribute('d', d)
  }

  useMotionValueEvent(cx, 'change', applyShape)

  useEffect(() => {
    const controls = animate(cx, slotCenter(idx), SPRING)
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  // Initial paint (before any animation)
  useEffect(() => { applyShape(cx.get()) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2">
      {/* Background glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2">
        <svg xmlns="http://www.w3.org/2000/svg" width="330" height="66" viewBox="0 0 367 82" fill="none">
          <g opacity="0.42" filter="url(#filter0_fn_36_4379)">
            <rect x="14" y="14" width="339" height="54" rx="24" fill="#080144"/>
            <rect x="23.6033" y="21.8389" width="326.516" height="43.5484" rx="21.7742" fill="#170B6E"/>
            <rect x="33.2067" y="30.5483" width="313.071" height="33.9677" rx="16.9839" fill="#3D309D"/>
            <rect x="42.8103" y="37.5156" width="288.102" height="20.0323" rx="10.0161" fill="#695DCA"/>
            <rect x="110.994" y="41.8711" width="200.711" height="9.58065" rx="4.79032" fill="#988DEF"/>
          </g>
          <defs>
            <filter id="filter0_fn_36_4379" x="0" y="0" width="367" height="82" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation="7" result="effect1_foregroundBlur_36_4379"/>
            </filter>
          </defs>
        </svg>
      </div>

      <nav
        ref={containerRef}
        className="relative"
        style={{ width: W, height: BOX_H, viewTransitionName: 'nav-bar' }}
      >
        {/* Soft drop shadow following the silhouette (under the glass) */}
        <div className="pointer-events-none absolute inset-0 translate-y-[6px] blur-[10px]">
          <svg width={W} height={BOX_H} className="overflow-visible">
            <path ref={shadowRef} fill="rgba(0,0,0,0.35)" />
          </svg>
        </div>

        {/* Glass, clipped to the gooey silhouette via --glass-clip */}
        <GlassPane borderRadius={30} className="absolute inset-0" />

        {/* Fill tint + rim stroke of the silhouette */}
        <div className="pointer-events-none absolute inset-0 z-10">
          <svg width={W} height={BOX_H} className="overflow-visible">
            <path ref={fillRef} fill="rgba(255,255,255,0.02)" />
            <path ref={strokeRef} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
          </svg>
        </div>

        {/* Active gradient disc riding with the bubble */}
        <motion.div
          className="pointer-events-none absolute z-20 h-[42px] w-[42px] overflow-hidden rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.4)]"
          style={{ x: discX, top: CY - 21 }}
        >
          <div
            className="absolute inset-0 flex items-center justify-center opacity-90 mix-blend-screen blur-[2px]"
            dangerouslySetInnerHTML={{ __html: activeSvgMask }}
          />
        </motion.div>

        {/* Icon row */}
        <div className="absolute inset-0 z-30 flex" style={{ padding: `0 ${PAD}px` }}>
          {pageOrder.map(id => {
            const active = id === activeId
            return (
              <button
                key={id}
                onClick={() => onChangePage(id)}
                aria-label={pages[id].title}
                className="relative flex h-full items-center justify-center"
                style={{ width: SLOT }}
              >
                <motion.span
                  initial={false}
                  animate={{ scale: active ? 1.15 : 1 }}
                  transition={SPRING}
                  className={`material-symbols-rounded text-[24px] transition-colors duration-200 ${active ? 'text-[#F8FAFC]' : 'text-[#F8FAFC]/60'}`}
                >
                  {pages[id].icon}
                </motion.span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
