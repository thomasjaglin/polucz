import { motion } from 'framer-motion'
import { pages, pageOrder } from '../../data/pages'
import { activeSvgMask } from '../../data/gradients'
import GlassPane from '../GlassPane'
import type { PageId } from '../../data/types'

interface Props {
  activeId: PageId
  onChangePage: (id: PageId) => void
}

// Bubble tab bar: one continuous glass bar; the active item sits in a glass
// bubble that bulges above the bar's top edge and springs between slots.
const SLOT = 56          // per-item width
const PAD = 10           // bar end padding
const BAR_H = 56
const BUBBLE = 58
const RAISE = 16         // how far the bubble/icon rise above the bar center

const SPRING = { type: 'spring', stiffness: 420, damping: 30 } as const

export default function BottomNav({ activeId, onChangePage }: Props) {
  const idx = Math.max(0, pageOrder.indexOf(activeId))
  const barW = PAD * 2 + SLOT * pageOrder.length
  const bubbleX = PAD + SLOT * idx + (SLOT - BUBBLE) / 2

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
        className="relative"
        style={{ width: barW, height: BAR_H, viewTransitionName: 'nav-bar' }}
      >
        {/* Bar frame */}
        <div className="absolute inset-0 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_0_0_1px_rgba(255,255,255,0.12)]">
          <GlassPane borderRadius={BAR_H / 2} className="absolute inset-0 rounded-full bg-white/[0.02]" />
        </div>

        {/* Sliding bubble — a glass circle bulging above the bar, still
            overlapping it so the two read as one attached shape */}
        <motion.div
          className="absolute rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_0_0_1px_rgba(255,255,255,0.12)]"
          style={{ width: BUBBLE, height: BUBBLE, top: (BAR_H - BUBBLE) / 2 - RAISE }}
          initial={false}
          animate={{ x: bubbleX }}
          transition={SPRING}
        >
          <GlassPane borderRadius={BUBBLE / 2} className="absolute inset-0 rounded-full bg-white/[0.02]" />
          {/* Active gradient disc, riding inside the bubble */}
          <div className="absolute left-1/2 top-1/2 z-10 h-[42px] w-[42px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.4)]">
            <div
              className="absolute inset-0 flex items-center justify-center opacity-90 mix-blend-screen blur-[2px]"
              dangerouslySetInnerHTML={{ __html: activeSvgMask }}
            />
          </div>
        </motion.div>

        {/* Icon row */}
        <div className="absolute inset-0 flex" style={{ padding: `0 ${PAD}px` }}>
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
                  animate={{ y: active ? -RAISE : 0, scale: active ? 1.15 : 1 }}
                  transition={SPRING}
                  className={`material-symbols-rounded relative z-10 text-[24px] transition-colors duration-200 ${active ? 'text-[#F8FAFC]' : 'text-[#F8FAFC]/60'}`}
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
