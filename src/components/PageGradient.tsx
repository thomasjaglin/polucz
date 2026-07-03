import { pages } from '../data/pages'
import type { PageId } from '../data/types'

interface Props {
  activeId: PageId
}

export default function PageGradient({ activeId }: Props) {
  return (
    <div
      className="app-bg-layer pointer-events-none absolute inset-0 z-20 flex justify-center overflow-hidden"
      style={{ viewTransitionName: 'page-gradient' }}
      dangerouslySetInnerHTML={{ __html: pages[activeId].gradient }}
    />
  )
}
