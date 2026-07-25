import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { pages, pageOrder } from '../../data/pages'
import GlassPane from '../GlassPane'
import type { PageId } from '../../data/types'

interface Props {
  activeId: PageId
  onChangePage: (id: PageId) => void
}

const SPRING = { type: 'spring', stiffness: 420, damping: 34 } as const

// Simple glass nav: a rounded pill frame (same liquid-glass styling as the rest
// of the app) holding the page icons, with a soft highlight that slides to the
// active item.
export default function BottomNav({ activeId, onChangePage }: Props) {
  const outerRef = useRef<HTMLDivElement | null>(null)

  // Keep the nav pinned to the physical screen bottom when the keyboard opens.
  // On mobile the visual viewport shrinks and fixed elements float above the
  // keyboard — hide the nav so it doesn't cover the active input field.
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
    <div
      ref={outerRef}
      className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-[60] -translate-x-1/2"
    >
      <nav
        className="relative flex items-center gap-1 rounded-full p-2 shadow-[0_8px_32px_rgba(0,0,0,0.28),inset_0_0_0_1px_rgba(255,255,255,0.12)]"
        style={{ viewTransitionName: 'nav-bar' }}
      >
        {/* Same glass recipe as the cards: a GlassPane base the shared canvas
            refracts, plus the inset white ring that reads the edge as glass. */}
        <GlassPane borderRadius={31} className="absolute inset-0 rounded-full bg-white/[0.02]" />
        {pageOrder.map(id => {
          const active = id === activeId
          return (
            <button
              key={id}
              onClick={() => onChangePage(id)}
              aria-label={pages[id].title}
              className="relative z-10 flex h-[46px] w-[46px] items-center justify-center rounded-full"
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  transition={SPRING}
                  className="absolute inset-[5px] rounded-full bg-white/[0.12] shadow-[inset_0_1px_1px_rgba(255,255,255,0.18)]"
                />
              )}
              <span
                className={`material-symbols-rounded relative text-[24px] transition-colors duration-200 ${active ? 'text-[#F8FAFC]' : 'text-[#F8FAFC]/55'}`}
              >
                {pages[id].icon}
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
