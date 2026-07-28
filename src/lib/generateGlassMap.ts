// Liquid-glass displacement maps, following kube.io/blog/liquid-glass-css-svg:
// a convex-squircle bezel profile refracted through Snell's law (n₂ = 1.5)
// produces the displacement magnitudes; vectors are normalized so the maximum
// displacement doubles as the filter's scale; a specular rim-light layer is
// blended over the refracted result.

import {
  GLASS_OVERSCAN,
  BEZEL_WIDTH,
  THICKNESS,
  REFRACTIVE_INDEX,
  LIGHT_X,
  LIGHT_Y,
  specularIntensity,
  refractionProfile,
  sdfRoundRect,
} from './glassParams'

// One map carries everything: R/G encode the X/Y displacement (128 = neutral)
// and B is a signed relief channel — 128 neutral, above = rim highlight,
// below = rim shade. The filter splits B back out with feColorMatrix — a
// single feImage avoids Chromium's unreliable handling of multiple data-URL
// feImages in one filter. The highlight/shade pair is what makes thin glass
// (logo strokes) read as 3D relief where refraction alone is invisible.
export interface GlassMaps {
  url: string
  scale: number // max displacement in px — use as feDisplacementMap scale
}

export const RELIEF_NEUTRAL = 128

// Re-exported for the filter plumbing in useGlassFilter.
export { GLASS_OVERSCAN }

interface GlassMapOptions {
  bezelWidth?: number      // px of rim that refracts (flat glass beyond it)
  thickness?: number       // glass slab thickness in px
  refractiveIndex?: number // n₂ of the glass; air n₁ = 1 is implied
}

// Rect panes keep their highlight-only look: B in [128, 255]
function reliefHighlight(ox: number, oy: number, rim: number): number {
  return RELIEF_NEUTRAL + Math.round(127 * specularIntensity(ox, oy, rim))
}

export function generateGlassMap(
  width: number,
  height: number,
  borderRadius: number,
  { bezelWidth = BEZEL_WIDTH, thickness = THICKNESS, refractiveIndex = REFRACTIVE_INDEX }: GlassMapOptions = {}
): GlassMaps {
  // Canvas covers the overscanned ::before area; the element's rounded rect
  // sits centered with GLASS_OVERSCAN px of neutral (no-displacement) padding.
  const mapW = width + GLASS_OVERSCAN * 2
  const mapH = height + GLASS_OVERSCAN * 2
  const canvas = document.createElement('canvas')
  canvas.width = mapW
  canvas.height = mapH
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(mapW, mapH)
  const d = img.data

  const hw = width / 2
  const hh = height / 2
  const r = Math.min(borderRadius, hw, hh)
  const bezel = Math.min(bezelWidth, hw, hh)
  const { mags, max } = refractionProfile(bezel, thickness, refractiveIndex)
  const eps = 0.5

  for (let y = 0; y < mapH; y++) {
    for (let x = 0; x < mapW; x++) {
      const px = x - GLASS_OVERSCAN - hw
      const py = y - GLASS_OVERSCAN - hh
      const i = (y * mapW + x) * 4

      const dist = sdfRoundRect(px, py, hw, hh, r)
      // dist < 0 means inside; edgeDist is how far inside we are
      const edgeDist = -dist
      const u = edgeDist / bezel

      // Outside the element, or on the flat slab beyond the bezel:
      // neutral displacement, neutral relief.
      if (edgeDist <= 0 || u >= 1) {
        d[i] = 128; d[i + 1] = 128; d[i + 2] = RELIEF_NEUTRAL; d[i + 3] = 255
        continue
      }

      // Normalized refraction strength at this depth into the bezel
      const strength = mags[Math.round(u * (mags.length - 1))] / max

      // Outward normal via SDF gradient (numerical)
      const gx = (sdfRoundRect(px + eps, py, hw, hh, r) - sdfRoundRect(px - eps, py, hw, hh, r)) / (2 * eps)
      const gy = (sdfRoundRect(px, py + eps, hw, hh, r) - sdfRoundRect(px, py - eps, hw, hh, r)) / (2 * eps)
      const len = Math.sqrt(gx * gx + gy * gy) || 1
      const ox = gx / len
      const oy = gy / len

      // Inward displacement (toward center) — bends the backdrop in at edges
      d[i]     = Math.round(128 - ox * strength * 127)
      d[i + 1] = Math.round(128 - oy * strength * 127)
      d[i + 2] = reliefHighlight(ox, oy, strength)
      d[i + 3] = 255
    }
  }

  ctx.putImageData(img, 0, 0)
  return { url: canvas.toDataURL(), scale: max }
}

function clampUnit(v: number): number {
  return v < -1 ? -1 : v > 1 ? 1 : v
}

// Separable box blur over a scalar field. Two passes give a smooth
// (triangle-kernel) falloff — enough for gradient extraction.
function boxBlur(a: Float32Array, w: number, h: number, r: number): Float32Array {
  const size = 2 * r + 1
  const tmp = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0
      for (let k = -r; k <= r; k++) sum += a[y * w + Math.min(Math.max(x + k, 0), w - 1)]
      tmp[y * w + x] = sum / size
    }
  }
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0
      for (let k = -r; k <= r; k++) sum += tmp[Math.min(Math.max(y + k, 0), h - 1) * w + x]
      out[y * w + x] = sum / size
    }
  }
  return out
}

export interface MaskGlassCanvas {
  canvas: HTMLCanvasElement
  scale: number
}

// Builds displacement + specular maps from an arbitrary alpha mask (e.g. the
// logo letterforms) instead of a rounded rect. The mask is drawn into a canvas
// padded by GLASS_OVERSCAN, its alpha is blurred, and the alpha gradient —
// which points into the shape, matching the inward displacement of the rect
// maps — provides both the displacement direction and the rim normals.
// Returns the raw canvas so the WebGL renderer can upload it as a texture;
// generateMaskGlassMap below wraps it as a data URL for the SVG filter path.
export interface MaskGlassOptions {
  blurRadius?: number
  scale?: number
  highlight?: number // rim-light strength on light-facing edges (0..1)
  shade?: number     // rim-shadow strength on away-facing edges (0..1)
  /** Encode the (crisp) shape coverage into the alpha channel — used by the
   *  WebGL renderer to frost the whole silhouette interior. Must stay OFF
   *  for maps destined for SVG filters: their pipeline premultiplies by
   *  alpha, which would corrupt the R/G displacement values. */
  coverageAlpha?: boolean
}

export function generateMaskGlassCanvas(
  width: number,
  height: number,
  drawMask: (ctx: CanvasRenderingContext2D) => void,
  { blurRadius = 3, scale = 30, highlight = 0.9, shade = 0.6, coverageAlpha = false }: MaskGlassOptions = {}
): MaskGlassCanvas {
  const mapW = width + GLASS_OVERSCAN * 2
  const mapH = height + GLASS_OVERSCAN * 2
  const canvas = document.createElement('canvas')
  canvas.width = mapW
  canvas.height = mapH
  const ctx = canvas.getContext('2d')!
  ctx.save()
  ctx.translate(GLASS_OVERSCAN, GLASS_OVERSCAN)
  drawMask(ctx)
  ctx.restore()

  const src = ctx.getImageData(0, 0, mapW, mapH).data
  let alpha: Float32Array<ArrayBufferLike> = new Float32Array(mapW * mapH)
  for (let i = 0; i < mapW * mapH; i++) alpha[i] = src[i * 4 + 3] / 255
  alpha = boxBlur(alpha, mapW, mapH, blurRadius)
  alpha = boxBlur(alpha, mapW, mapH, blurRadius)

  const img = ctx.createImageData(mapW, mapH)
  const d = img.data
  // Max slope of the blurred edge is ~1/(2r+1); this gain renormalizes the
  // gradient so displacement reaches full strength right at letter edges.
  const gain = 2 * blurRadius + 1
  for (let y = 0; y < mapH; y++) {
    const ym = Math.max(y - 1, 0) * mapW
    const yp = Math.min(y + 1, mapH - 1) * mapW
    for (let x = 0; x < mapW; x++) {
      const xm = Math.max(x - 1, 0)
      const xp = Math.min(x + 1, mapW - 1)
      // Alpha gradient points into the letterform (inward)
      const nx = clampUnit(((alpha[y * mapW + xp] - alpha[y * mapW + xm]) / 2) * gain)
      const ny = clampUnit(((alpha[yp + x] - alpha[ym + x]) / 2) * gain)
      const i = (y * mapW + x) * 4
      d[i]     = Math.round(128 + nx * 127)
      d[i + 1] = Math.round(128 + ny * 127)
      d[i + 3] = coverageAlpha ? src[i + 3] : 255

      // Signed relief: light-facing edges brighten, away-facing edges darken.
      // Thin strokes can't show much refraction, so this highlight/shadow
      // pair is what makes them read as dimensional glass.
      const mag = Math.hypot(nx, ny)
      if (mag > 0.05) {
        const lit = (-nx / mag) * LIGHT_X + (-ny / mag) * LIGHT_Y
        const hl = lit > 0 ? lit * lit * mag * highlight : 0
        const sh = lit < 0 ? lit * lit * mag * shade : 0
        d[i + 2] = RELIEF_NEUTRAL + Math.round(clampUnit(hl - sh) * 127)
      } else {
        d[i + 2] = RELIEF_NEUTRAL
      }
    }
  }

  ctx.putImageData(img, 0, 0)
  return { canvas, scale }
}

export function generateMaskGlassMap(
  width: number,
  height: number,
  drawMask: (ctx: CanvasRenderingContext2D) => void,
  opts: MaskGlassOptions = {}
): GlassMaps {
  const { canvas, scale } = generateMaskGlassCanvas(width, height, drawMask, opts)
  return { url: canvas.toDataURL(), scale }
}
