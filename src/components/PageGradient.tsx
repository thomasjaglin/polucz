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

  return (
    <div
      className="app-bg-layer pointer-events-none absolute inset-0 z-20 flex justify-center overflow-hidden"
      style={{ viewTransitionName: 'page-gradient' }}
      dangerouslySetInnerHTML={{ __html: pages[activeId].gradient }}
    />
  )
}
