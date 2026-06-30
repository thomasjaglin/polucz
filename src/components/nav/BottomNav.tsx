import { groupNavItems } from '../../lib/groupNavItems'
import { pageOrder } from '../../data/pages'
import NavPill from './NavPill'
import ActiveNavItem from './ActiveNavItem'
import type { PageId } from '../../data/types'

interface Props {
  activeId: PageId
  onChangePage: (id: PageId) => void
}

export default function BottomNav({ activeId, onChangePage }: Props) {
  const groups = groupNavItems(pageOrder, activeId)

  return (
    <div className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center justify-center transition-all duration-300">
      {/* Background glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2">
        <svg xmlns="http://www.w3.org/2000/svg" width="412" height="82" viewBox="0 0 367 82" fill="none">
          <g opacity="0.42" filter="url(#filter0_fn_36_4379)">
            <rect x="14" y="14" width="339" height="54" rx="24" fill="#080144"/>
            <rect x="23.6033" y="21.8389" width="326.516" height="43.5484" rx="21.7742" fill="#170B6E"/>
            <rect x="33.2067" y="30.5483" width="313.071" height="33.9677" rx="16.9839" fill="#3D309D"/>
            <rect x="42.8103" y="37.5156" width="288.102" height="20.0323" rx="10.0161" fill="#695DCA"/>
            <rect x="110.994" y="41.8711" width="200.711" height="9.58065" rx="4.79032" fill="#988DEF"/>
          </g>
          <defs>
            <filter id="filter0_fn_36_4379" x="0" y="0" width="367" height="82" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation="7" result="effect1_foregroundBlur_36_4379"/>
            </filter>
          </defs>
        </svg>
      </div>

      {/* Nav items */}
      <nav
        className="flex w-[374px] items-center justify-between"
        style={{ viewTransitionName: 'nav-bar' }}
      >
        {groups.map((group, i) =>
          group.type === 'active' ? (
            <ActiveNavItem key={group.id} id={group.id} />
          ) : (
            <NavPill key={i} ids={group.ids} onChangePage={onChangePage} />
          )
        )}
      </nav>
    </div>
  )
}
