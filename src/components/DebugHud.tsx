import { useEffect, useRef, useState } from 'react'
import { getGlassMode } from '../lib/glassMode'
import { getPanes, getMaskPanes, onPanesChanged } from '../webgl/glassStore'
import { glassDebug } from '../webgl/debugState'

interface Outline {
  x: number
  y: number
  w: number
  h: number
  radius: number
  area: number
}

interface MaskOutline {
  x: number
  y: number
  w: number
  h: number
  overscan: number
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
  const [maskOutlines, setMaskOutlines] = useState<MaskOutline[]>([])
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

      const nextMasks: MaskOutline[] = []
      for (const mp of getMaskPanes()) {
        const r = mp.el.getBoundingClientRect()
        nextMasks.push({ x: r.left, y: r.top, w: r.width, h: r.height, overscan: mp.overscan })
      }
      setMaskOutlines(nextMasks)

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
  // Sorted smallest-first, real (non-hidden, non-zero) panes only — matches
  // the shader's "smallest pane wins" pick order, so index 0 is whichever
  // pane actually renders at any pixel where outlines overlap. Hidden
  // (display:none) panes report 0x0 and are excluded so they don't drown
  // out the panes that are actually competing on screen.
  const sorted = [...outlines].filter(o => o.w >= 2 && o.h >= 2).sort((a, b) => a.area - b.area)

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
        {`mode: ${mode}\npanes: ${panes} / 48 (${sorted.length} real)\nmasks: ${masks} / 2\nDOM .kube-glass-bg: ${domCount}\n\n` +
          `GlassCanvas actual last frame:\nframe ${glassDebug.frame}, rendered @${glassDebug.lastRenderFrame} (${glassDebug.frame - glassDebug.lastRenderFrame} frames ago)\nsent uPaneCount=${glassDebug.lastPaneCount} uMaskCount=${glassDebug.lastMaskCount}\ndrawCalls total: ${glassDebug.drawCalls}\n` +
          (glassDebug.lastError ? `\nERROR @frame ${glassDebug.lastErrorFrame}:\n${glassDebug.lastError.slice(0, 300)}\n` : '\n(no error caught)\n') +
          `\nACTUAL uPane[]/uPaneRadius[] values sent to shader:\n` +
          glassDebug.lastPaneSample.map((p, i) => `${i}: ${p.w.toFixed(1)}x${p.h.toFixed(1)} @${p.x.toFixed(1)},${p.y.toFixed(1)} r${p.r.toFixed(1)}`).join('\n') +
          `\n\nuniform constants sent:\n` +
          Object.entries(glassDebug.uniforms).map(([k, v]) => `${k}=${v.toFixed(3)}`).join('  ') +
          `\n\nreadPixels GROUND TRUTH @ ${glassDebug.readPixelAt}:\nRGBA = ${glassDebug.readPixel.join(', ')}\n` +
          `\nedge profile (distance in from top edge -> RGBA):\n` +
          glassDebug.edgeProfile.map(e => `${e.distIn}px in: ${e.rgba.join(',')}`).join('\n') +
          `\n\nsmallest-first REAL panes (independently computed):\n` +
          sorted.slice(0, 10).map((o, i) => `${i}: ${Math.round(o.w)}x${Math.round(o.h)} @${Math.round(o.x)},${Math.round(o.y)} r${o.radius}`).join('\n') +
          `\n\nmasks (checked BEFORE panes, first 2 win):\n` +
          maskOutlines.slice(0, 3).map((m, i) => `${i}: ${Math.round(m.w)}x${Math.round(m.h)} @${Math.round(m.x)},${Math.round(m.y)} +${m.overscan}`).join('\n')}
      </div>
      {outlines.filter(o => o.w >= 2 && o.h >= 2).map((o, i) => (
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
      {maskOutlines.map((m, i) => (
        <div
          key={`mask-${i}`}
          style={{
            position: 'fixed',
            left: m.x - m.overscan,
            top: m.y - m.overscan,
            width: m.w + m.overscan * 2,
            height: m.h + m.overscan * 2,
            border: '2px dashed cyan',
            boxSizing: 'border-box',
            pointerEvents: 'none',
            zIndex: 999998,
          }}
        />
      ))}
    </>
  )
}
