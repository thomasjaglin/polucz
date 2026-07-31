import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import GlassPane from './GlassPane'
import { useToasts } from '../lib/toastStore'

// Global toast stack, top of the screen. Portalled to <body> so it's positioned
// against the viewport regardless of any transformed ancestor.
export default function Toaster() {
  const toasts = useToasts()
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 z-[120] flex flex-col items-center gap-2 px-4"
      style={{ top: 'calc(1rem + env(safe-area-inset-top))' }}
    >
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="relative max-w-full overflow-hidden rounded-full border border-[#F8FAFC]/10 px-5 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
          >
            <GlassPane borderRadius={999} className="absolute inset-0 z-0 rounded-full bg-[#F8FAFC]/10" />
            <span className="relative z-10 block truncate font-instrument text-[14px] text-[#F8FAFC]/80">{t.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  )
}
