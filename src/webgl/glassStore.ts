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

// A single free-form glass shape (the logo letterforms): its displacement +
// specular map is prebaked into a canvas (see generateMaskGlassCanvas) and
// sampled by the renderer over the element's overscanned rect.
export interface MaskPaneRecord {
  el: HTMLElement
  map: HTMLCanvasElement // R/G = displacement, B = specular, like the SVG maps
  scale: number          // displacement px at full deflection
  overscan: number       // map padding beyond the element, px per side
}

let maskPane: MaskPaneRecord | null = null

export function registerMaskPane(rec: MaskPaneRecord): () => void {
  maskPane = rec
  listeners.forEach(l => l())
  return () => {
    if (maskPane === rec) maskPane = null
    listeners.forEach(l => l())
  }
}

export function getMaskPane(): MaskPaneRecord | null {
  return maskPane
}
