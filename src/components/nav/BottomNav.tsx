import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { pages, pageOrder } from '../../data/pages'
import GlassPane from '../GlassPane'
import { haptics } from '../../lib/haptics'
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

  // Hide the nav while the on-screen keyboard is open so it doesn't float over
  // the input. The keyboard shrinks either the visual viewport (browser overlay
  // mode) OR the whole layout viewport (Android WebView `adjustResize`) — the
  // old `innerHeight - visualViewport.height` check missed the latter (both
  // shrink together). Instead compare the current viewport height against the
  // tallest we've seen (= no keyboard); a big drop means the keyboard is up.
  useEffect(() => {
    const vv = window.visualViewport
    let baseline = window.innerHeight
    function update() {
      if (!outerRef.current) return
      baseline = Math.max(baseline, window.innerHeight)
      const h = vv ? vv.height : window.innerHeight
      // Keyboards are ~250-350px tall; the 120px floor ignores the mobile URL
      // bar (~60-100px) so it doesn't false-trigger.
      const open = h < baseline - 120
      // display:none (not opacity:0) so the nav's rect collapses to zero — the
      // shared WebGL canvas draws the nav glass from that rect, and a hidden-but-
      // present rect would still float the glass up above the keyboard.
      outerRef.current.style.display = open ? 'none' : ''
    }
    vv?.addEventListener('resize', update)
    window.addEventListener('resize', update)
    update()
    return () => {
      vv?.removeEventListener('resize', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <div
      ref={outerRef}
      className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-[60] -translate-x-1/2"
    >
      <nav
        className="relative flex items-center gap-1 rounded-full p-2 glass-raise"
        style={{ viewTransitionName: 'nav-bar' }}
      >
        {/* Same glass recipe as the cards: a GlassPane base the shared canvas
            refracts, plus the inset white ring that reads the edge as glass. */}
        <GlassPane borderRadius={36} className="absolute inset-0 rounded-full bg-ink/[0.02]" />
        {pageOrder.map(id => {
          const active = id === activeId
          return (
            <button
              key={id}
              onClick={() => { if (id !== activeId) haptics.select(); onChangePage(id) }}
              aria-label={pages[id].title}
              className="relative z-10 flex h-[46px] w-[46px] items-center justify-center rounded-full"
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  transition={SPRING}
                  className="absolute inset-[5px] rounded-full bg-ink/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.18)]"
                />
              )}
              <span
                className={`material-symbols-rounded relative text-[24px] transition-colors duration-200 ${active ? 'text-ink' : 'text-ink/55'}`}
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
