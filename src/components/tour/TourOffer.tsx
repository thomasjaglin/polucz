import { motion } from 'framer-motion'
import GlassPane from '../GlassPane'
import GlassButton from '../GlassButton'

// The "want a quick tour of this page?" card.
//
// Shown once, the first time a page has something worth demonstrating, and never
// again whichever way it is answered. Deliberately small and low in the screen:
// it is an offer, not a wall, and the page behind it stays fully usable if the
// user simply ignores it.

interface Props {
  title: string
  blurb: string
  onTake: () => void
  onSkip: () => void
}

export default function TourOffer({ title, blurb, onTake, onSkip }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16, transition: { duration: 0.16, ease: 'easeIn' } }}
      transition={{ duration: 0.28, ease: [0.33, 1, 0.68, 1] }}
      className="fixed inset-x-4 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-[150] overflow-hidden rounded-[28px] border border-ink/10 glass-raise"
    >
      <GlassPane borderRadius={28} className="absolute inset-0 z-0 rounded-[28px] bg-surface/80" />
      <div className="relative z-10 flex flex-col gap-3 p-5">
        <div>
          <p className="font-instrument text-[15px] font-semibold text-ink">{title}</p>
          <p className="mt-1 font-instrument text-[13px] leading-relaxed text-ink/70">{blurb}</p>
        </div>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onSkip}
            className="font-instrument text-[13px] ink-tertiary underline underline-offset-4"
          >
            No thanks
          </button>
          <GlassButton
            variant="primary"
            onClick={onTake}
            className="px-5 py-2 font-instrument text-[14px]"
          >
            Show me
          </GlassButton>
        </div>
      </div>
    </motion.div>
  )
}
