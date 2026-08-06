import { motion, AnimatePresence } from 'framer-motion'

// Hard-mode toggle pill used in both the flashcard menu and the in-game header.
// Hard mode flips the prompt to English→Polish. The label shows the action: it
// reads "Hard" in easy mode and flips to "Easy" in hard mode (press to switch
// back). The pill highlights while hard mode is engaged.
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
      <span className="relative inline-block w-[30px] text-left" style={{ perspective: 400 }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={active ? 'easy' : 'hard'}
            initial={{ rotateX: -90, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1 }}
            exit={{ rotateX: 90, opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="block font-instrument text-[12px] font-medium"
          >
            {active ? 'Easy' : 'Hard'}
          </motion.span>
        </AnimatePresence>
      </span>
    </button>
  )
}
