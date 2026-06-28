import type { WordType } from '../data/types'
import { tagGradients } from '../data/gradients'

interface Props {
  id: WordType
  label: string
  active: boolean
  onToggle: () => void
}

export default function FilterTag({ id, label, active, onToggle }: Props) {
  return (
    // Outer: gradient border ring, same structure as IconButton
    <button
      onClick={onToggle}
      className="flex rounded-[124px] bg-gradient-to-br from-white/30 via-white/5 to-transparent p-[1px] shadow-[0_4px_16px_rgba(0,0,0,0.3)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
    >
      {/* Inner: dark glass surface, same bg/shadow as IconButton glass div */}
      <div className="relative flex items-center justify-center rounded-[123px] bg-[#1a1a1a]/40 px-[12px] py-[4px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.3)] kube-glass-bg">
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
      </div>
    </button>
  )
}
