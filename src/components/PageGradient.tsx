import { pages } from '../data/pages'
import type { PageId } from '../data/types'

interface Props {
  activeId: PageId
}

export default function PageGradient({ activeId }: Props) {
  // The translate page has no page gradient in any renderer: its colour comes
  // entirely from the gradient blob backing the source side. In webgl mode the
  // shader paints it (backgroundData.ts `translate`); otherwise TranslatePage
  // renders the same artwork as a DOM layer. Falling back to the shared main
  // stack here would paint the folder page's red over both.
  if (activeId === 'translate') return null

  const page = pages[activeId]

  // Both variants are rendered and CSS picks one. A theme swap is then a class
  // on <html> with nothing to re-render — and no subscription here, which would
  // otherwise be the only reason this component needed state at all. Pages
  // without a light variant fall back to the dark one.
  return (
    <>
      <div
        className="app-bg-layer theme-dark-only pointer-events-none absolute inset-0 z-20 flex justify-center overflow-hidden"
        style={{ viewTransitionName: 'page-gradient' }}
        dangerouslySetInnerHTML={{ __html: page.gradient }}
      />
      {page.gradientLight && (
        <div
          className="app-bg-layer theme-light-only pointer-events-none absolute inset-0 z-20 flex justify-center overflow-hidden"
          dangerouslySetInnerHTML={{ __html: page.gradientLight }}
        />
      )}
    </>
  )
}
