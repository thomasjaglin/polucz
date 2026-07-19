// Registry of live glass panes for the WebGL renderer. In 'webgl' glass mode,
// useGlassFilter registers each pane's element here instead of building SVG
// filters; GlassCanvas reads rects from the registered elements every frame
// it renders.

export interface PaneRecord {
  el: HTMLElement
  borderRadius: number
}

const panes = new Set<PaneRecord>()
const listeners = new Set<() => void>()

export function registerPane(rec: PaneRecord): () => void {
  panes.add(rec)
  listeners.forEach(l => l())
  return () => {
    panes.delete(rec)
    listeners.forEach(l => l())
  }
}

export function getPanes(): ReadonlySet<PaneRecord> {
  return panes
}

export function onPanesChanged(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// Free-form glass shapes (logo letterforms, the gooey nav, the translate
// page's background blob, ...): each one's displacement + specular map is
// prebaked into a canvas (see generateMaskGlassCanvas) and sampled by the
// renderer over the element's overscanned rect. GlassCanvas only has texture
// budget for MAX_MASK_PANES slots (see there) — registering beyond that just
// won't be drawn, so keep simultaneous mask consumers to that count.
export interface MaskPaneRecord {
  el: HTMLElement
  map: HTMLCanvasElement // R/G = displacement, B = specular, like the SVG maps
  scale: number          // displacement px at full deflection
  overscan: number       // map padding beyond the element, px per side
}

const maskPanes = new Set<MaskPaneRecord>()

export function registerMaskPane(rec: MaskPaneRecord): () => void {
  maskPanes.add(rec)
  listeners.forEach(l => l())
  return () => {
    maskPanes.delete(rec)
    listeners.forEach(l => l())
  }
}

export function getMaskPanes(): ReadonlySet<MaskPaneRecord> {
  return maskPanes
}
