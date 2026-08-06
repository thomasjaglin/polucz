// Hard-mode toggle pill used in both the flashcard menu and the in-game header.
// Hard mode flips the prompt to English→Polish; the pill highlights when active.
export default function HardModeToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] transition-colors ${
        active
          ? 'border-[#e879f9]/40 bg-[#e879f9]/15 text-[#F8FAFC]'
          : 'border-[#F8FAFC]/10 bg-[#F8FAFC]/[0.04] text-[#F8FAFC]/55'
      }`}
    >
      <span className="material-symbols-rounded text-[15px]">bolt</span>
      <span className="font-instrument text-[12px] font-medium">Hard</span>
    </button>
  )
}
