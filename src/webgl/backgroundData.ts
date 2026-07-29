// Procedural description of the DOM background for the WebGL renderer —
// a hand-mirrored transcription of the SVG ellipse stacks in data/pages.ts
// (blurred concentric ellipses, screen-blended over the base color).
// If pages.ts gradients change, this table must be updated to match.

import type { PageId } from '../data/types'
import type { AudioCardBlob } from './glassStore'

// Per-word-type colour glow baked behind the audio card so its transparent
// glass refracts a coloured surface (mirrors the tagGradients palette).
const AUDIO_BLOB_COLORS: Record<string, string[]> = {
  noun:      ['#FF5D00', '#FDCF2D', '#FFE79E'],
  verb:      ['#0099FF', '#CB9EFF', '#2DFD8E'],
  adjective: ['#6AFF00', '#9BBD21', '#0C4A30'],
  unknown:   ['#BF00FF', '#4821BD', '#8A2BE2'],
}

export interface BgEllipse {
  cx: number; cy: number   // viewBox units
  rx: number; ry: number
  color: string            // hex fill
}

export interface BgLayer {
  viewW: number            // svg viewBox size
  viewH: number
  widthPx: number          // rendered CSS width (w-[…px])
  widthFracVw?: number     // width as fraction of viewport width (overrides widthPx)
  heightFracVh?: number    // height as fraction of viewport height — enables a
                           // separate y-scale (non-uniform stretch); without it
                           // the layer scales uniformly by the x-scale
  topFrac: number          // CSS top as fraction of viewport height
  leftFrac?: number        // CSS left as fraction of viewport width
  rightFrac?: number       // CSS right as fraction of viewport width
  centered?: boolean       // horizontally centered (flex justify-center)
  dynamicTop?: boolean     // topFrac is driven at runtime (translate blob swap)
  clipEllipse?: { widthFracVw: number; heightFracVh: number } // confine the
                           // layer to a centered ellipse at its (dynamic) top

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
  // The translate blob (translate-gradient.svg): a wide, viewport-relative
  // gradient circle that slides between the top/bottom halves on language swap.
  // Rendered procedurally so the page's glass panes refract it natively (the
  // old DOM <img> sat above the canvas and occluded the glass). topFrac is
  // driven at runtime (see setBgBlobTop); default is the source-on-top position.
  translate: [{
    viewW: 959.4, viewH: 908.4,
    widthPx: 0, widthFracVw: 2.0169, heightFracVh: 0.8514,
    // leftFrac mirrors the old img: circle centered (-17.5vw) + its -11.3%
    // internal offset of the 135vw circle → -0.32755·vw. topFrac is the ring's
    // top so the blob, its clip, and the glass disc all share one reference.
    topFrac: -0.22, dynamicTop: true, leftFrac: -0.32755, rotDeg: 0,
    // Clip the (right-offset, oversized) gradient to the centered circle disc —
    // the ring ellipse: 135vw × 73.4vh, centered, at the layer's (dynamic) top.
    clipEllipse: { widthFracVw: 1.35, heightFracVh: 0.734 },
    opacity: 0.6, blurPx: 30,
    ellipses: [
      { cx: 336.2, cy: 586.7, rx: 247.5, ry: 210, color: '#D94C30' },
      { cx: 648.2, cy: 634.7, rx: 247.5, ry: 210, color: '#EE9B3D' },
      { cx: 311.2, cy: 273.7, rx: 247.5, ry: 210, color: '#FF15B5' },
      { cx: 501.2, cy: 363.7, rx: 247.5, ry: 210, color: '#FC484B' },
    ],
  }],
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
// `dynamicTopFrac` overrides topFrac for any layer flagged dynamicTop (the
// translate blob, which slides on language swap).
export function resolvePageUniforms(page: PageId, vw: number, vh: number, dynamicTopFrac?: number, audioCard?: AudioCardBlob | null) {
  const layers = pageBackgrounds[page] ?? []
  const geo = new Float32Array(MAX_ELLIPSES * 4)     // cx, cy, rx, ry
  const misc = new Float32Array(MAX_ELLIPSES * 4)    // sinθ, cosθ, layerIndex, 0
  const color = new Float32Array(MAX_ELLIPSES * 3)
  const layerParams = new Float32Array(MAX_LAYERS * 2) // opacity, blurPx
  const clip = new Float32Array(4) // cx, cy, rx, ry (rx<=0 disables)
  let clipLayer = -1 // which layer index the clip applies to (-1 = all)
  let n = 0

  layers.forEach((layer, li) => {
    const widthPx = layer.widthFracVw !== undefined ? layer.widthFracVw * vw : layer.widthPx
    const scaleX = widthPx / layer.viewW
    // Separate y-scale for a non-uniform stretch (blob); default uniform.
    const scaleY = layer.heightFracVh !== undefined
      ? (layer.heightFracVh * vh) / layer.viewH
      : scaleX
    const topFrac = layer.dynamicTop && dynamicTopFrac !== undefined ? dynamicTopFrac : layer.topFrac
    const top = topFrac * vh
    if (layer.clipEllipse) {
      const cw = layer.clipEllipse.widthFracVw * vw
      const ch = layer.clipEllipse.heightFracVh * vh
      clip[0] = vw / 2               // centered
      clip[1] = top + ch / 2         // centered on the ring box at this top
      clip[2] = cw / 2
      clip[3] = ch / 2
      clipLayer = li
    }
    const left = layer.centered
      ? (vw - widthPx) / 2
      : layer.leftFrac !== undefined
        ? layer.leftFrac * vw
        : vw - widthPx - (layer.rightFrac ?? 0) * vw
    const rot = (layer.rotDeg * Math.PI) / 180
    layerParams[li * 2] = layer.opacity
    layerParams[li * 2 + 1] = layer.blurPx

    for (const e of layer.ellipses) {
      if (n >= MAX_ELLIPSES) break
      geo[n * 4] = left + scaleX * e.cx
      geo[n * 4 + 1] = top + scaleY * e.cy
      geo[n * 4 + 2] = scaleX * e.rx
      geo[n * 4 + 3] = scaleY * e.ry
      misc[n * 4] = Math.sin(rot)
      misc[n * 4 + 1] = Math.cos(rot)
      misc[n * 4 + 2] = li
      const [r, g, b] = hexToRgb(e.color)
      color[n * 3] = r; color[n * 3 + 1] = g; color[n * 3 + 2] = b
      n++
    }
  })

  // Audio card colour glow: a soft coloured blob at the current card's rect so
  // the card's transparent glass refracts it (real rim light) with a per-word
  // colour. Appended as the next layer (spatial_audio's main glow is layer 0).
  if (page === 'spatial_audio' && audioCard) {
    const li = layers.length
    if (li < MAX_LAYERS) {
      const cols = AUDIO_BLOB_COLORS[audioCard.type] ?? AUDIO_BLOB_COLORS.unknown
      layerParams[li * 2] = 0.85     // opacity
      layerParams[li * 2 + 1] = 55   // blurPx — soft enough that the blobs melt together
      const { cx, cy, rx, ry } = audioCard
      // Mask the glow to the card so it doesn't halo past it (like the translate
      // disc). Ellipse a touch larger than the card to cover its rounded corners.
      clip[0] = cx; clip[1] = cy; clip[2] = rx * 1.08; clip[3] = ry * 1.12
      clipLayer = li
      // Round blobs (not eccentric ellipses, which pinch into a star at the
      // card's wide aspect) spread across the width; the clip above shapes the
      // combined glow to the card's elliptical outline.
      const R = Math.max(ry * 1.5, rx * 0.34)
      const spread = [-0.6, 0, 0.6]
      for (let k = 0; k < spread.length; k++) {
        if (n >= MAX_ELLIPSES) break
        geo[n * 4]     = cx + spread[k] * rx
        geo[n * 4 + 1] = cy
        geo[n * 4 + 2] = R
        geo[n * 4 + 3] = R
        misc[n * 4] = 0; misc[n * 4 + 1] = 1; misc[n * 4 + 2] = li
        const [r, g, b] = hexToRgb(cols[k] ?? cols[0])
        color[n * 3] = r; color[n * 3 + 1] = g; color[n * 3 + 2] = b
        n++
      }
    }
  }

  return { geo, misc, color, layerParams, clip, clipLayer, count: n }
}
