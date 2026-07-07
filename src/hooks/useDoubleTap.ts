import { useRef, useCallback } from 'react'

export function useDoubleTap(callback: () => void, threshold = 300) {
  const lastTap = useRef<number>(0)

  const trigger = useCallback(() => {
    const now = Date.now()
    if (now - lastTap.current < threshold) {
      lastTap.current = 0
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
