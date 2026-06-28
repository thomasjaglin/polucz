import { pages } from '../../data/pages'
import type { PageId } from '../../data/types'
import GlassPane from '../GlassPane'

interface Props {
  ids: PageId[]
  onChangePage: (id: PageId) => void
}

export default function NavPill({ ids, onChangePage }: Props) {
  return (
    <div className="flex items-center justify-center rounded-[42px] shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_0_0_1px_rgba(255,255,255,0.12)] transition-all">
      <div className="relative flex h-[64px] items-center justify-center gap-[24px] rounded-[42px] px-[24px] py-[11px]">
        <GlassPane borderRadius={42} className="absolute inset-0 z-0 rounded-[42px] bg-white/[0.02]" />
        <div className="relative z-10 flex items-center gap-[24px]">
          {ids.map(id => (
            <button
              key={id}
              onClick={() => onChangePage(id)}
              style={{ viewTransitionName: `icon-${id}` }}
              className="relative flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.3)] transition-colors group"
            >
              <GlassPane borderRadius={21} className="absolute inset-0 z-0 rounded-full bg-white/[0.01] group-hover:bg-white/[0.06]" />
              <span className="material-symbols-rounded relative z-10 text-[24px] text-[#F8FAFC]/70">
                {pages[id].icon}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
