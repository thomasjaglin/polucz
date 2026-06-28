import { pages } from '../../data/pages'
import type { PageId } from '../../data/types'

interface Props {
  ids: PageId[]
  onChangePage: (id: PageId) => void
}

export default function NavPill({ ids, onChangePage }: Props) {
  return (
    <div className="flex items-center justify-center rounded-[42px] bg-gradient-to-br from-white/30 via-white/5 to-transparent p-[1px] shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all">
      <div className="relative flex h-[64px] items-center justify-center gap-[24px] rounded-[41px] px-[24px] py-[11px]">
        <div className="absolute inset-0 z-0 rounded-[41px] bg-[#1a1a1a]/40 kube-glass-bg" />
        <div className="relative z-10 flex items-center gap-[24px]">
          {ids.map(id => (
            <button
              key={id}
              onClick={() => onChangePage(id)}
              style={{ viewTransitionName: `icon-${id}` }}
              className="relative flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.3)] transition-colors group"
            >
              <div className="absolute inset-0 z-0 rounded-full bg-white/[0.01] group-hover:bg-white/[0.06] kube-glass-bg" />
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
