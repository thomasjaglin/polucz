import { useEffect, useState } from 'react'
import { getGlassMode } from '../lib/glassMode'
import { getPanes, getMaskPanes, onPanesChanged } from '../webgl/glassStore'

// Temporary diagnostic overlay for the flat-modal-on-mobile investigation.
// Enable with ?debug=1. Safe to delete once the root cause is confirmed.
export default function DebugHud() {
  const [, forceTick] = useState(0)

  useEffect(() => {
    const unsub = onPanesChanged(() => forceTick(t => t + 1))
    const interval = setInterval(() => forceTick(t => t + 1), 500)
    return () => { unsub(); clearInterval(interval) }
  }, [])

  const mode = getGlassMode()
  const panes = getPanes().size
  const masks = getMaskPanes().size

  return (
    <div
      style={{
        position: 'fixed',
        top: 4,
        left: 4,
        zIndex: 999999,
        background: 'rgba(0,0,0,0.8)',
        color: '#4ade80',
        font: '11px/1.4 monospace',
        padding: '6px 10px',
        borderRadius: 8,
        pointerEvents: 'none',
        whiteSpace: 'pre',
      }}
    >
      {`mode: ${mode}\npanes: ${panes} / 48\nmasks: ${masks} / 2`}
    </div>
  )
}
