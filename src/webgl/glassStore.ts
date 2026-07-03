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
