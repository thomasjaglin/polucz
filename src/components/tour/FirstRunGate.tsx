import { motion } from 'framer-motion'
import GlassButton from '../GlassButton'
import GlassPane from '../GlassPane'

// The very first screen. Three doors, because setting up keys and taking the
// tour are separate questions: the keys are a chore, the tour is the payoff, and
// bundling them means whoever dutifully pastes two keys lands in an empty app
// with no idea what to do.

interface Props {
  onSetUpKeys: () => void
  onTakeTour: () => void
  onSkip: () => void
}

export default function FirstRunGate({ onSetUpKeys, onTakeTour, onSkip }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="fixed inset-0 z-[190] flex items-center justify-center px-6"
    >
      <div className="absolute inset-0 bg-[var(--veil-modal)]" />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.33, 1, 0.68, 1] }}
        className="relative w-full max-w-[380px] overflow-hidden rounded-[36px] border border-ink/10 glass-raise"
      >
        <GlassPane borderRadius={36} className="absolute inset-0 z-0 rounded-[36px] bg-ink/[0.04]" />
        <div className="relative z-10 flex flex-col gap-5 p-7">
          <div className="flex flex-col gap-2">
            <p className="font-instrument text-[13px] font-medium uppercase tracking-wider text-accent">
              Witam!
            </p>
            <h1 className="font-instrument text-[24px] font-semibold leading-tight text-ink">
              Welcome to Polucz
            </h1>
            <p className="font-instrument text-[15px] leading-relaxed text-ink/75">
              Translate what you come across, understand what words are being used, build your deck
              of vocabulary and learn those words in context gradually until you know them fully!
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <GlassButton
              variant="primary"
              onClick={onTakeTour}
              className="w-full px-5 py-3 font-instrument text-[15px]"
            >
              Show me around
            </GlassButton>
            <GlassButton
              variant="secondary"
              onClick={onSetUpKeys}
              className="w-full px-5 py-3 font-instrument text-[14px]"
            >
              Set up my keys first
            </GlassButton>
            <button
              onClick={onSkip}
              className="mt-1 font-instrument text-[13px] ink-tertiary underline underline-offset-4"
            >
              Skip for now
            </button>
          </div>

          <p className="font-instrument text-[12px] leading-relaxed ink-tertiary">
            The tour can be replayed at any time from the Help page.
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}
