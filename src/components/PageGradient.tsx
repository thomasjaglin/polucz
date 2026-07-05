import { pages } from '../data/pages'
import type { PageId } from '../data/types'

interface Props {
  activeId: PageId
}

export default function PageGradient({ activeId }: Props) {
  // The translate page paints its own moving gradient circle over the plain
  // dots background (Figma 114-9301 / 114-13593) — no page gradient there.
  if (activeId === 'translate') return null

  return (
    <div
      className="app-bg-layer pointer-events-none absolute inset-0 z-20 flex justify-center overflow-hidden"
      style={{ viewTransitionName: 'page-gradient' }}
      dangerouslySetInnerHTML={{ __html: pages[activeId].gradient }}
    />
  )
}
