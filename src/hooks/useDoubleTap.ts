import { useRef, useCallback } from 'react'
import { haptics } from '../lib/haptics'

export function useDoubleTap(callback: () => void, threshold = 300) {
  const lastTap = useRef<number>(0)

  const trigger = useCallback(() => {
    const now = Date.now()
    if (now - lastTap.current < threshold) {
      lastTap.current = 0
      haptics.doubleTap()
      callback()
    } else {
      lastTap.current = now
    }
  }, [callback, threshold])

  return {
    onTouchEnd: (e: React.TouchEvent) => {
      e.stopPropagation()
      trigger()
    },
    onClick: (e: React.MouseEvent) => {
      if (e.detail === 2) callback()
    },
  }
}
