import { motion } from 'framer-motion'
import GlassPane from '../GlassPane'
import GlassButton from '../GlassButton'

// The sign-off, shown once the arrival tour finishes.
//
// It exists to close one honest gap. The tour makes no calls at all, so the
// translation it showed was a sample and the user has still never made a real
// request — someone who pasted a key has not proved it works, and someone who
// has not would otherwise leave thinking translation is free. One line handles
// both, and points at the place where the first real use happens.

interface Props {
  onTranslate: () => void
  onDismiss: () => void
}

export default function TourComplete({ onTranslate, onDismiss }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="fixed inset-0 z-[190] flex items-end justify-center px-4 pb-[calc(2rem+env(safe-area-inset-bottom))]"
    >
      <div className="absolute inset-0 bg-[var(--veil-modal)]" onClick={onDismiss} />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.33, 1, 0.68, 1] }}
        className="relative w-full max-w-[380px] overflow-hidden rounded-[32px] border border-ink/10 glass-raise"
      >
        <GlassPane borderRadius={32} className="absolute inset-0 z-0 rounded-[32px] bg-surface/85" />
        <div className="relative z-10 flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-2">
            <p className="font-instrument text-[13px] font-medium uppercase tracking-wider text-accent">
              That is the loop
            </p>
            <h2 className="font-instrument text-[21px] font-semibold leading-tight text-ink">
              Two words down
            </h2>
            <p className="font-instrument text-[14px] leading-relaxed text-ink/75">
              That translation was a sample, so nothing was sent anywhere. Translate a sentence of
              your own to add real words — that needs a DeepL key, and writing the cards needs an
              LLM key. Everything you just saw works without either.
            </p>
          </div>
          <div className="flex flex-col gap-2.5">
            <GlassButton
              variant="primary"
              onClick={onTranslate}
              className="w-full px-5 py-3 font-instrument text-[15px]"
            >
              Try a sentence of my own
            </GlassButton>
            <button
              onClick={onDismiss}
              className="font-instrument text-[13px] ink-tertiary underline underline-offset-4"
            >
              Later — let me look around
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
