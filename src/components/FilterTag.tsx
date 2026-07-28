import type { WordType } from '../data/types'
import { tagGradients } from '../data/gradients'
import GlassPane from './GlassPane'

interface Props {
  id: WordType | 'mastered'
  label: string
  active: boolean
  onToggle: () => void
}

export default function FilterTag({ id, label, active, onToggle }: Props) {
  return (
    // Outer: gradient border ring, same structure as IconButton
    <button
      onClick={onToggle}
      className="flex rounded-[124px] shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_0_0_1px_rgba(255,255,255,0.12)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
    >
      <GlassPane borderRadius={62} className="relative flex items-center justify-center rounded-[124px] bg-[#F8FAFC]/[0.02] px-[12px] py-[4px]">
        {active && (
          <div
            className="absolute inset-0 z-0 flex items-center justify-center mix-blend-screen opacity-80"
            dangerouslySetInnerHTML={{ __html: tagGradients[id] }}
          />
        )}
        <span
          className={`relative z-10 font-instrument text-[10px] font-normal transition-colors ${
            active ? 'text-[#F8FAFC]' : 'text-[#F8FAFC]/50'
          }`}
        >
          {label}
        </span>
      </GlassPane>
    </button>
  )
}
