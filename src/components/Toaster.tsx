import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import GlassPane from './GlassPane'
import { useToasts, type ToastTone } from '../lib/toastStore'

const TONE: Record<ToastTone, { pane: string; border: string; icon: string; iconColor: string }> = {
  success: { pane: 'bg-emerald-400/15', border: 'border-emerald-400/25', icon: 'check_circle', iconColor: 'text-emerald-300' },
  error:   { pane: 'bg-red-400/15',     border: 'border-red-400/30',     icon: 'error',        iconColor: 'text-red-300' },
  info:    { pane: 'bg-[#F8FAFC]/10',   border: 'border-[#F8FAFC]/10',   icon: 'info',         iconColor: 'text-[#F8FAFC]/50' },
}

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
        {toasts.map(t => {
          const tone = TONE[t.tone]
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`relative max-w-full overflow-hidden rounded-full border ${tone.border} px-5 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.3)]`}
            >
              <GlassPane borderRadius={999} className={`absolute inset-0 z-0 rounded-full ${tone.pane}`} />
              <span className="relative z-10 flex items-center gap-2">
                <span className={`material-symbols-rounded shrink-0 text-[16px] ${tone.iconColor}`}>{tone.icon}</span>
                <span className="truncate font-instrument text-[14px] text-[#F8FAFC]/85">{t.text}</span>
              </span>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>,
    document.body,
  )
}
