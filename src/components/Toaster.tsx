import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import GlassPane from './GlassPane'
import { useToasts, type ToastTone } from '../lib/toastStore'
import type { PageId } from '../data/types'

const TONE: Record<ToastTone, { pane: string; border: string; icon: string; iconColor: string }> = {
  success: { pane: 'bg-emerald-400/20', border: 'border-emerald-400/35', icon: 'check_circle', iconColor: 'text-emerald-300' },
  error:   { pane: 'bg-red-400/20',     border: 'border-red-400/40',     icon: 'error',        iconColor: 'text-red-300' },
  delete:  { pane: 'bg-red-400/20',     border: 'border-red-400/35',     icon: 'delete',       iconColor: 'text-red-300' },
  info:    { pane: 'bg-ink/10',   border: 'border-ink/12',   icon: 'info',         iconColor: 'text-ink/50' },
}

// Global toast stack, top of the screen. Portalled to <body> so it's positioned
// against the viewport regardless of any transformed ancestor.
export default function Toaster({ activeId }: { activeId?: PageId }) {
  const toasts = useToasts()
  if (typeof document === 'undefined') return null

  // The vocab list has the download/add/settings buttons in the top strip, so
  // drop the toasts below them there; every other page uses the usual top inset.
  const top = activeId === 'folder'
    ? 'calc(env(safe-area-inset-top) + 4.75rem)'
    : 'calc(1rem + env(safe-area-inset-top))'

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 z-[120] flex flex-col items-center gap-2 px-4"
      style={{ top }}
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
                <span className="truncate font-instrument text-[14px] text-ink/85">{t.text}</span>
              </span>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>,
    document.body,
  )
}
