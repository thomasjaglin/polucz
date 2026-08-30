import { useSyncExternalStore } from 'react'
import { pages } from '../data/pages'
import type { PageId } from '../data/types'
import { getBgHardMode, onBgChange } from '../webgl/glassStore'

interface Props {
  activeId: PageId
}

export default function PageGradient({ activeId }: Props) {
  // Flashcard hard mode recolours the flashcard background. The flag already
  // lives in glassStore (FlashcardPage sets it for the webgl renderer and
  // clears it on unmount), so read it from there rather than threading the
  // flashcard's state up through App just to reach this layer.
  const hardMode = useSyncExternalStore(onBgChange, getBgHardMode, () => false)

  // The translate page has no page gradient in any renderer: its colour comes
  // entirely from the gradient blob backing the source side. In webgl mode the
  // shader paints it (backgroundData.ts `translate`); otherwise TranslatePage
  // renders the same artwork as a DOM layer. Falling back to the shared main
  // stack here would paint the folder page's red over both.
  if (activeId === 'translate') return null

  const page = pages[activeId]
  const hard = hardMode && activeId === 'dynamic_feed'
  const dark = (hard && page.gradientHard) || page.gradient
  const light = hard ? (page.gradientHardLight ?? page.gradientHard) : page.gradientLight

  // Both theme variants are rendered and CSS picks one. A theme swap is then a
  // class on <html> with nothing to re-render. Pages without a light variant
  // fall back to the dark one.
  return (
    <>
      <div
        key={hard ? 'hard-dark' : 'dark'}
        className="app-bg-layer theme-dark-only pointer-events-none absolute inset-0 z-20 flex justify-center overflow-hidden"
        style={{ viewTransitionName: 'page-gradient' }}
        dangerouslySetInnerHTML={{ __html: dark }}
      />
      {light && (
        <div
          key={hard ? 'hard-light' : 'light'}
          className="app-bg-layer theme-light-only pointer-events-none absolute inset-0 z-20 flex justify-center overflow-hidden"
          dangerouslySetInnerHTML={{ __html: light }}
        />
      )}
    </>
  )
}
