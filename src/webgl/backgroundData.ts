// Procedural description of the DOM background for the WebGL renderer —
// a hand-mirrored transcription of the SVG ellipse stacks in data/pages.ts
// (blurred concentric ellipses, screen-blended over the dot grid + vignette).
// If pages.ts gradients change, this table must be updated to match.

import type { PageId } from '../data/types'

export interface BgEllipse {
  cx: number; cy: number   // viewBox units
  rx: number; ry: number
  color: string            // hex fill
}

export interface BgLayer {
  viewW: number            // svg viewBox size
  viewH: number
  widthPx: number          // rendered CSS width (w-[…px])
  topFrac: number          // CSS top as fraction of viewport height
  leftFrac?: number        // CSS left as fraction of viewport width
  rightFrac?: number       // CSS right as fraction of viewport width
  centered?: boolean       // horizontally centered (flex justify-center)
  rotDeg: number           // shared rotate(θ cx cy) of every ellipse
  opacity: number          // CSS opacity on the svg
  blurPx: number           // CSS blur() on the svg (post-scale pixels)
  ellipses: BgEllipse[]    // painted in order (later on top)
}

// The five main pages share one centered stack; only fills differ.
const MAIN_GEO = [
  { cx: 205, cy: 95.5, rx: 252, ry: 430.5 },
  { cx: 205, cy: 43.3958, rx: 252, ry: 378.396 },
  { cx: 205, cy: -18.9583, rx: 252, ry: 316.042 },
  { cx: 205, cy: -88.1458, rx: 252, ry: 246.854 },
  { cx: 205, cy: -145.375, rx: 252, ry: 189.625 },
]

function mainLayer(colors: string[]): BgLayer {
  return {
    viewW: 412, viewH: 598, widthPx: 504,
    topFrac: -0.10, centered: true, rotDeg: 0,
    opacity: 0.5, blurPx: 36,
    ellipses: MAIN_GEO.map((g, i) => ({ ...g, color: colors[i] })),
  }
}

// add_page / api_config left stack (rotated)
const SIDE_GEO = [
  { cx: -11.3347, cy: 72.7827, rx: 254.534, ry: 325.96 },
  { cx: -44.6114, cy: 51.5914, rx: 254.534, ry: 286.508 },
  { cx: -84.4344, cy: 26.2312, rx: 254.534, ry: 239.296 },
  { cx: -128.622, cy: -1.90822, rx: 254.534, ry: 186.909 },
  { cx: -165.171, cy: -25.184, rx: 254.534, ry: 143.577 },
]

function sideLayer(colors: string[]): BgLayer {
  return {
    viewW: 401, viewH: 463, widthPx: 509,
    topFrac: -0.05, leftFrac: -0.20, rotDeg: -57.5101,
    opacity: 0.28, blurPx: 46,
    ellipses: SIDE_GEO.map((g, i) => ({ ...g, color: colors[i] })),
  }
}

export const pageBackgrounds: Record<PageId, BgLayer[]> = {
  folder:        [mainLayer(['#4A0101', '#8B0909', '#C82A2A', '#F57D7D', '#FFFFFF'])],
  translate:     [mainLayer(['#01404A', '#09808B', '#2ABFC8', '#7DF5EE', '#FFFFFF'])],
  dynamic_feed:  [mainLayer(['#014A2D', '#098B42', '#2AC87C', '#B3F57D', '#FFFFFF'])],
  question_mark: [mainLayer(['#484A01', '#8B8009', '#C8AB2A', '#FFDEB3', '#FFFFFF'])],
  spatial_audio: [mainLayer(['#14014A', '#16098B', '#2A59C8', '#7DD1F5', '#FFFFFF'])],
  add_page: [
    sideLayer(['#014A2D', '#094A8B', '#2A5FC8', '#A97DF5', '#FFFFFF']),
    {
      viewW: 412, viewH: 535, widthPx: 779,
      topFrac: 0.35, rightFrac: -0.40, rotDeg: 149.296,
      opacity: 0.31, blurPx: 46,
      ellipses: [
        { cx: 420.864, cy: 636.619, rx: 389.525, ry: 509.094, color: '#014A2D' },
        { cx: 452.325, cy: 689.598, rx: 389.525, ry: 447.477, color: '#094A8B' },
        { cx: 489.975, cy: 753, rx: 389.525, ry: 373.739, color: '#2A5FC8' },
        { cx: 531.751, cy: 823.349, rx: 389.525, ry: 291.921, color: '#A97DF5' },
        { cx: 566.307, cy: 881.539, rx: 389.525, ry: 224.244, color: '#FFFFFF' },
      ],
    },
  ],
  api_config: [sideLayer(['#4A014A', '#8B098B', '#C82AC8', '#F57DF5', '#FFFFFF'])],
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ]
}

export const MAX_ELLIPSES = 10
export const MAX_LAYERS = 2

// Flatten a page's layers into shader-ready arrays in viewport CSS pixels.
export function resolvePageUniforms(page: PageId, vw: number, vh: number) {
  const layers = pageBackgrounds[page] ?? []
  const geo = new Float32Array(MAX_ELLIPSES * 4)     // cx, cy, rx, ry
  const misc = new Float32Array(MAX_ELLIPSES * 4)    // sinθ, cosθ, layerIndex, 0
  const color = new Float32Array(MAX_ELLIPSES * 3)
  const layerParams = new Float32Array(MAX_LAYERS * 2) // opacity, blurPx
  let n = 0

  layers.forEach((layer, li) => {
    const scale = layer.widthPx / layer.viewW
    const top = layer.topFrac * vh
    const left = layer.centered
      ? (vw - layer.widthPx) / 2
      : layer.leftFrac !== undefined
        ? layer.leftFrac * vw
        : vw - layer.widthPx - (layer.rightFrac ?? 0) * vw
    const rot = (layer.rotDeg * Math.PI) / 180
    layerParams[li * 2] = layer.opacity
    layerParams[li * 2 + 1] = layer.blurPx

    for (const e of layer.ellipses) {
      if (n >= MAX_ELLIPSES) break
      geo[n * 4] = left + scale * e.cx
      geo[n * 4 + 1] = top + scale * e.cy
      geo[n * 4 + 2] = scale * e.rx
      geo[n * 4 + 3] = scale * e.ry
      misc[n * 4] = Math.sin(rot)
      misc[n * 4 + 1] = Math.cos(rot)
      misc[n * 4 + 2] = li
      const [r, g, b] = hexToRgb(e.color)
      color[n * 3] = r; color[n * 3 + 1] = g; color[n * 3 + 2] = b
      n++
    }
  })

  return { geo, misc, color, layerParams, count: n }
}
