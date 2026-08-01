import { motion } from 'framer-motion'
import GlassPane from './GlassPane'

// Shared glass progress bar (flashcard / audio / quiz pages): a blue→purple
// gradient fill on a frosted track, with the count on the right. Keeping it in
// one place ensures the three pages stay visually aligned.
export default function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 100 : Math.round((done / total) * 100)
  return (
    <div className="flex w-full items-center gap-3">
      <div className="relative h-[12px] flex-1 overflow-hidden rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]">
        <GlassPane borderRadius={6} className="absolute inset-0 z-0 rounded-full bg-[#F8FAFC]/[0.02]" />
        <motion.div
          className="relative z-10 h-full rounded-full bg-gradient-to-r from-[#60A5FA]/70 to-[#B4A0FF]/70 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
      <span className="font-instrument text-[13px] tabular-nums text-[#F8FAFC]/30">
        {done}/{total}
      </span>
    </div>
  )
}
