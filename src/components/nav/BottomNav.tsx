import { useEffect, useRef } from 'react'
import { motion, useMotionValue, useTransform, useMotionValueEvent, animate } from 'framer-motion'
import { pages, pageOrder } from '../../data/pages'
import { activeSvgMask } from '../../data/gradients'
import { generateMaskGlassMap } from '../../lib/generateGlassMap'
import { upsertFilter } from '../../hooks/useGlassFilter'
import { getGlassMode } from '../../lib/glassMode'
import { GLASS_OVERSCAN } from '../../lib/glassParams'
import type { PageId } from '../../data/types'

interface Props {
  activeId: PageId
  onChangePage: (id: PageId) => void
}

// Gooey tab bar, illustration-style: the active item's circle is the SAME
// height as the bar and sits in a gap in it, joined by deep concave neck
// fillets (two-metaball union). The inactive icons reflow into the bar
// segments. When the first/last item is active, the bar's own end boundary
// collapses onto the circle so the circle terminates the bar — no leftover
// end cap. Glass comes from a mask-derived displacement/relief map built
// from the actual silhouette, so refraction and rim light follow the shape.
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

const NAV_FILTER_ID = 'kube-glass-nav'
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
// bl/br are the bar's live end boundaries (bl rises to cx−R when the first
// item is active, br drops to cx+R for the last) — at that point the end
// cap coincides with the bubble and the circle terminates the bar.
// Clockwise path.
function gooeyPath(cx: number, bl: number, br: number, off = 0): string {
  const k = R / (R + NECK)
  const o = off
  const p = (n: number) => (n + o).toFixed(2)

  const side = (D: number) => {
    const q = Math.sqrt(Math.max((R + NECK) ** 2 - (D / 2) ** 2, 0))
    return {
      e: k * (D / 2),        // tangent x-offset from centers
      ty: CY - k * q,        // tangent y (top side)
      by: CY + k * q,        // tangent y (bottom side)
    }
  }

  const capL = Math.max(cx - GAP_D, bl + R)  // left segment inner-cap center
  const capR = Math.min(cx + GAP_D, br - R)  // right segment inner-cap center
  const L = side(Math.max(cx - capL, 0))
  const Rt = side(Math.max(capR - cx, 0))

  return [
    `M ${p(bl + R)} ${p(0)}`,
    `H ${p(capL)}`,
    `A ${R} ${R} 0 0 1 ${p(capL + L.e)} ${p(L.ty)}`,          // left inner cap
    `A ${NECK} ${NECK} 0 0 0 ${p(cx - L.e)} ${p(L.ty)}`,      // left neck
    `A ${R} ${R} 0 0 1 ${p(cx + Rt.e)} ${p(Rt.ty)}`,          // over the bubble
    `A ${NECK} ${NECK} 0 0 0 ${p(capR - Rt.e)} ${p(Rt.ty)}`,  // right neck
    `A ${R} ${R} 0 0 1 ${p(capR)} ${p(0)}`,                   // up right inner cap
    `H ${p(br - R)}`,
    `A ${R} ${R} 0 0 1 ${p(br)} ${p(CY)}`,                    // right end cap
    `A ${R} ${R} 0 0 1 ${p(br - R)} ${p(BAR_H)}`,
    `H ${p(capR)}`,
    `A ${R} ${R} 0 0 1 ${p(capR - Rt.e)} ${p(Rt.by)}`,        // bottom mirror
    `A ${NECK} ${NECK} 0 0 0 ${p(cx + Rt.e)} ${p(Rt.by)}`,
    `A ${R} ${R} 0 0 1 ${p(cx - L.e)} ${p(L.by)}`,
    `A ${NECK} ${NECK} 0 0 0 ${p(capL + L.e)} ${p(L.by)}`,
    `A ${R} ${R} 0 0 1 ${p(capL)} ${p(BAR_H)}`,
    `H ${p(bl + R)}`,
    `A ${R} ${R} 0 0 1 ${p(bl)} ${p(CY)}`,                    // left end cap
    `A ${R} ${R} 0 0 1 ${p(bl + R)} ${p(0)}`,
    'Z',
  ].join(' ')
}

const blTarget = (idx: number, centers: number[]) => (idx === 0 ? centers[0] - R : 0)
const brTarget = (idx: number, centers: number[]) => (idx === N - 1 ? centers[N - 1] + R : W)

export default function BottomNav({ activeId, onChangePage }: Props) {
  const idx = Math.max(0, pageOrder.indexOf(activeId))
  const glassMode = getGlassMode()
  const outerRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const fillRef = useRef<SVGPathElement | null>(null)
  const strokeRef = useRef<SVGPathElement | null>(null)
  const shadowRef = useRef<SVGPathElement | null>(null)
  const lastMapAt = useRef(0)

  const centers = slotCenters(idx)
  const cx = useMotionValue(centers[idx])
  const bl = useMotionValue(blTarget(idx, centers))
  const br = useMotionValue(brTarget(idx, centers))
  const discX = useTransform(cx, v => v - 21) // 42px gradient disc
  // Keep the visible silhouette centered while an end boundary is collapsed
  const shiftX = useTransform([bl, br], (v: number[]) => -((v[0] + v[1]) / 2 - W / 2))

  // Displacement/relief map from the current silhouette — refraction and rim
  // light follow the gooey outline instead of the old rectangular pane map.
  function regenMap() {
    if (glassMode !== 'svg') return
    const d = gooeyPath(cx.get(), bl.get(), br.get())
    const maps = generateMaskGlassMap(
      W, BAR_H,
      ctx => { ctx.fillStyle = '#fff'; ctx.fill(new Path2D(d)) },
      { blurRadius: 4, scale: 36, highlight: 0.55, shade: 0.1 },
    )
    upsertFilter(NAV_FILTER_ID, maps, W, BAR_H)
    lastMapAt.current = performance.now()
  }

  function applyShape() {
    const v = cx.get(), a = bl.get(), b = br.get()
    const d = gooeyPath(v, a, b)
    containerRef.current?.style.setProperty('--glass-clip', `path('${gooeyPath(v, a, b, GLASS_OVERSCAN)}')`)
    fillRef.current?.setAttribute('d', d)
    strokeRef.current?.setAttribute('d', d)
    shadowRef.current?.setAttribute('d', d)
    // Refresh the glass map at ~15fps while in flight; the settle pass in the
    // animation's onComplete does the final exact one
    if (performance.now() - lastMapAt.current > 66) regenMap()
  }

  useMotionValueEvent(cx, 'change', applyShape)
  useMotionValueEvent(bl, 'change', applyShape)
  useMotionValueEvent(br, 'change', applyShape)

  useEffect(() => {
    const controls = [
      animate(cx, centers[idx], { ...SPRING, onComplete: () => { applyShape(); regenMap() } }),
      animate(bl, blTarget(idx, centers), SPRING),
      animate(br, brTarget(idx, centers), SPRING),
    ]
    return () => controls.forEach(c => c.stop())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  // Initial paint + cleanup
  useEffect(() => {
    applyShape()
    regenMap()
    return () => {
      document.querySelector(`#kube-glass-filters #${NAV_FILTER_ID}`)?.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the nav pinned to the physical screen bottom when the keyboard opens.
  // On mobile, the visual viewport shrinks (keyboard takes space) and fixed
  // elements float above the keyboard — push the nav back down so it doesn't
  // cover the active input field.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    function update() {
      if (!outerRef.current) return
      const keyboardH = window.innerHeight - vv!.height
      const open = keyboardH > 10
      outerRef.current.style.opacity = open ? '0' : ''
      outerRef.current.style.pointerEvents = open ? 'none' : ''
    }
    vv.addEventListener('resize', update)
    return () => vv.removeEventListener('resize', update)
  }, [])

  return (
    <div ref={outerRef} className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-[60] -translate-x-1/2">
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

      <motion.nav
        ref={containerRef}
        className="relative"
        style={{ width: W, height: BAR_H, x: shiftX, viewTransitionName: 'nav-bar' }}
      >
        {/* Soft drop shadow following the silhouette (under the glass) */}
        <div className="pointer-events-none absolute inset-0 translate-y-[6px] blur-[10px]">
          <svg width={W} height={BAR_H} className="overflow-visible">
            <path ref={shadowRef} fill="rgba(0,0,0,0.35)" />
          </svg>
        </div>

        {/* Glass layer: blur + silhouette displacement map, clipped to the
            silhouette via --glass-clip (inherited by the ::before) */}
        <div
          className="kube-glass-bg absolute inset-0"
          style={{ '--glass-filter': glassMode === 'svg' ? `url(#${NAV_FILTER_ID})` : 'none' } as React.CSSProperties}
        />

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
      </motion.nav>
    </div>
  )
}
