import { useEffect, useRef, useState } from 'react'
import { getGlassMode } from '../lib/glassMode'
import { getPanes, getMaskPanes, onPanesChanged } from '../webgl/glassStore'

interface Outline {
  x: number
  y: number
  w: number
  h: number
  radius: number
  area: number
}

// Temporary diagnostic overlay for the flat-modal-on-mobile investigation.
// Enable with ?debug=1. Safe to delete once the root cause is confirmed.
//
// Draws a live-updating colored outline around every registered pane's
// getBoundingClientRect() — exactly the rect the WebGL canvas reads every
// frame. If an outline doesn't line up with the element it's supposed to
// belong to (offset, zero-size, or hidden behind a bigger box), that's the
// canvas's own view of the world, not a rendering-only bug.
export default function DebugHud() {
  const [, forceTick] = useState(0)
  const [outlines, setOutlines] = useState<Outline[]>([])
  const rafRef = useRef(0)

  useEffect(() => {
    const unsub = onPanesChanged(() => forceTick(t => t + 1))
    const interval = setInterval(() => forceTick(t => t + 1), 500)

    function loop() {
      const next: Outline[] = []
      for (const p of getPanes()) {
        const r = p.el.getBoundingClientRect()
        next.push({ x: r.left, y: r.top, w: r.width, h: r.height, radius: p.borderRadius, area: r.width * r.height })
      }
      setOutlines(next)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => { unsub(); clearInterval(interval); cancelAnimationFrame(rafRef.current) }
  }, [])

  const mode = getGlassMode()
  const panes = getPanes().size
  const masks = getMaskPanes().size
  // DOM elements carrying the class vs. how many actually made it into the
  // JS registry — a mismatch here means elements render (and get the CSS)
  // but silently fail to registerPane(), which is the WebGL renderer's only
  // way of knowing they exist.
  const domCount = document.querySelectorAll('.kube-glass-bg').length
  // Sorted smallest-first — matches the shader's "smallest pane wins" pick
  // order, so index 0 in the list is whichever pane actually renders at any
  // pixel where outlines overlap.
  const sorted = [...outlines].sort((a, b) => a.area - b.area)

  return (
    <>
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
          maxWidth: '70vw',
          maxHeight: '80vh',
          overflow: 'hidden',
        }}
      >
        {`mode: ${mode}\npanes: ${panes} / 48\nmasks: ${masks} / 2\nDOM .kube-glass-bg: ${domCount}\n\nsmallest-first (shader pick order):\n` +
          sorted.slice(0, 8).map((o, i) => `${i}: ${Math.round(o.w)}x${Math.round(o.h)} @${Math.round(o.x)},${Math.round(o.y)} r${o.radius}`).join('\n')}
      </div>
      {outlines.map((o, i) => (
        <div
          key={i}
          style={{
            position: 'fixed',
            left: o.x,
            top: o.y,
            width: o.w,
            height: o.h,
            borderRadius: o.radius,
            border: '2px solid magenta',
            boxSizing: 'border-box',
            pointerEvents: 'none',
            zIndex: 999998,
          }}
        />
      ))}
    </>
  )
}
