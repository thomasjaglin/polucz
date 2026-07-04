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

// Gooey tab bar, illustration-style: the active item's circle is the SAME
// height as the bar and sits in a gap in it, joined on both sides by deep
// concave neck fillets (two-metaball union). The inactive icons reflow into
// the bar segments. Near the bar ends the neck distance shrinks, so the
// circle merges smoothly into the end cap instead of popping.
const BAR_H = 56
const R = BAR_H / 2       // bubble radius = bar half height = cap radius
const NECK = 14           // fillet radius of the concave necks
const GAP_D = 66          // bubble-center to segment-cap-center distance
const PAD = 8
const ACTIVE_W = 96       // slot width of the active item (room for the gap)
const REG_W = 46          // slot width of inactive items
const N = pageOrder.length
const W = PAD * 2 + ACTIVE_W + REG_W * (N - 1)
const CY = R

const SPRING = { type: 'spring', stiffness: 420, damping: 32 } as const

// Slot centers for a given active index (active slot is wider)
function slotCenters(idx: number): number[] {
  const centers: number[] = []
  let x = PAD
  for (let i = 0; i < N; i++) {
    const w = i === idx ? ACTIVE_W : REG_W
    centers.push(x + w / 2)
    x += w
  }
  return centers
}

// Union outline of the split bar and the bubble circle at center x = cx.
// Both bar-segment inner caps and the bubble have radius R; the concave
// necks are tangent fillet arcs of radius NECK. Clamping the cap-center
// distance to the bar's end caps makes the pinch relax smoothly to a full
// merge at the ends. Clockwise path.
function gooeyPath(cx: number, off = 0): string {
  const k = R / (R + NECK)
  const o = off
  const p = (n: number) => (n + o).toFixed(2)

  // Per-side neck geometry (D = distance bubble-center → cap-center)
  const side = (D: number) => {
    const q = Math.sqrt((R + NECK) ** 2 - (D / 2) ** 2)
    return {
      e: k * (D / 2),        // tangent x-offset on the bubble
      ty: CY - k * q,        // tangent y (top side)
      by: CY + k * q,        // tangent y (bottom side)
    }
  }

  const capL = Math.max(cx - GAP_D, R)       // left segment inner-cap center
  const capR = Math.min(cx + GAP_D, W - R)   // right segment inner-cap center
  const L = side(cx - capL)
  const Rt = side(capR - cx)

  return [
    `M ${p(R)} ${p(0)}`,
    `H ${p(capL)}`,
    `A ${R} ${R} 0 0 1 ${p(capL + L.e)} ${p(L.ty)}`,          // left inner cap
    `A ${NECK} ${NECK} 0 0 0 ${p(cx - L.e)} ${p(L.ty)}`,      // left neck
    `A ${R} ${R} 0 0 1 ${p(cx + Rt.e)} ${p(Rt.ty)}`,          // over the bubble
    `A ${NECK} ${NECK} 0 0 0 ${p(capR - Rt.e)} ${p(Rt.ty)}`,  // right neck
    `A ${R} ${R} 0 0 1 ${p(capR)} ${p(0)}`,                   // up right inner cap
    `H ${p(W - R)}`,
    `A ${R} ${R} 0 0 1 ${p(W)} ${p(CY)}`,                     // right end cap
    `A ${R} ${R} 0 0 1 ${p(W - R)} ${p(BAR_H)}`,
    `H ${p(capR)}`,
    `A ${R} ${R} 0 0 1 ${p(capR - Rt.e)} ${p(Rt.by)}`,        // bottom mirror
    `A ${NECK} ${NECK} 0 0 0 ${p(cx + Rt.e)} ${p(Rt.by)}`,
    `A ${R} ${R} 0 0 1 ${p(cx - L.e)} ${p(L.by)}`,
    `A ${NECK} ${NECK} 0 0 0 ${p(capL + L.e)} ${p(L.by)}`,
    `A ${R} ${R} 0 0 1 ${p(capL)} ${p(BAR_H)}`,
    `H ${p(R)}`,
    `A ${R} ${R} 0 0 1 ${p(0)} ${p(CY)}`,                     // left end cap
    `A ${R} ${R} 0 0 1 ${p(R)} ${p(0)}`,
    'Z',
  ].join(' ')
}

export default function BottomNav({ activeId, onChangePage }: Props) {
  const idx = Math.max(0, pageOrder.indexOf(activeId))
  const containerRef = useRef<HTMLDivElement | null>(null)
  const fillRef = useRef<SVGPathElement | null>(null)
  const strokeRef = useRef<SVGPathElement | null>(null)
  const shadowRef = useRef<SVGPathElement | null>(null)

  const centers = slotCenters(idx)
  const cx = useMotionValue(centers[idx])
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
    const controls = animate(cx, centers[idx], SPRING)
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
        style={{ width: W, height: BAR_H, viewTransitionName: 'nav-bar' }}
      >
        {/* Soft drop shadow following the silhouette (under the glass) */}
        <div className="pointer-events-none absolute inset-0 translate-y-[6px] blur-[10px]">
          <svg width={W} height={BAR_H} className="overflow-visible">
            <path ref={shadowRef} fill="rgba(0,0,0,0.35)" />
          </svg>
        </div>

        {/* Glass, clipped to the gooey silhouette via --glass-clip */}
        <GlassPane borderRadius={R} className="absolute inset-0" />

        {/* Fill tint + rim stroke of the silhouette */}
        <div className="pointer-events-none absolute inset-0 z-10">
          <svg width={W} height={BAR_H} className="overflow-visible">
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

        {/* Icons — absolutely positioned so they reflow around the gap */}
        <div className="absolute inset-0 z-30">
          {pageOrder.map((id, i) => {
            const active = id === activeId
            return (
              <motion.button
                key={id}
                onClick={() => onChangePage(id)}
                aria-label={pages[id].title}
                className="absolute top-0 flex h-full w-[46px] items-center justify-center"
                initial={false}
                animate={{ x: centers[i] - 23, scale: active ? 1.15 : 1 }}
                transition={SPRING}
              >
                <span className={`material-symbols-rounded text-[24px] transition-colors duration-200 ${active ? 'text-[#F8FAFC]' : 'text-[#F8FAFC]/60'}`}>
                  {pages[id].icon}
                </span>
              </motion.button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
