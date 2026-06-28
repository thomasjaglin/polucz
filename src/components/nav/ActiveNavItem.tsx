import { pages } from '../../data/pages'
import { activeSvgMask } from '../../data/gradients'
import type { PageId } from '../../data/types'

interface Props {
  id: PageId
}

export default function ActiveNavItem({ id }: Props) {
  return (
    <div className="flex h-[66px] w-[66px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-white/30 via-white/5 to-transparent p-[1px] shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all">
      <div className="relative flex h-full w-full items-center justify-center rounded-full">
        <div className="absolute inset-0 z-0 rounded-full bg-[#1a1a1a]/40 kube-glass-bg" />
        <button
          style={{ viewTransitionName: `icon-${id}` }}
          className="relative z-10 flex h-[42px] w-[42px] shrink-0 items-center justify-center overflow-hidden rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.4)]"
        >
          <div
            className="absolute inset-0 z-0 flex items-center justify-center opacity-90 mix-blend-screen blur-[2px]"
            dangerouslySetInnerHTML={{ __html: activeSvgMask }}
          />
          <span className="material-symbols-rounded relative z-10 text-[24px] text-[#F8FAFC]">
            {pages[id].icon}
          </span>
        </button>
      </div>
    </div>
  )
}
