import { useEffect, useRef } from 'react'
import { pushLayer } from '../lib/backStack'

// Registers an open overlay with the global back-stack so the Android hardware
// back button closes it (instead of navigating history or exiting the app).
// Pass the layer's logical "is open" flag and the same close handler the UI
// uses. Stacks naturally: nested/overlapping overlays close topmost-first.
export function useBackClose(isOpen: boolean, onClose: () => void) {
  // Keep the latest onClose without re-registering the layer on every render.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!isOpen) return
    return pushLayer(() => onCloseRef.current())
  }, [isOpen])
}
