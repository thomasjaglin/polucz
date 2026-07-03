// Liquid-glass displacement maps, following kube.io/blog/liquid-glass-css-svg:
// a convex-squircle bezel profile refracted through Snell's law (n₂ = 1.5)
// produces the displacement magnitudes; vectors are normalized so the maximum
// displacement doubles as the filter's scale; a specular rim-light layer is
// blended over the refracted result.

// One map carries everything: R/G encode the X/Y displacement (128 = neutral)
// and B encodes the specular rim intensity (0–255). The filter splits B back
// out with feColorMatrix — a single feImage avoids Chromium's unreliable
// handling of multiple data-URL feImages in one filter.
export interface GlassMaps {
  url: string
  scale: number // max displacement in px — use as feDisplacementMap scale
}

// The filter is applied to the .kube-glass-bg::before pseudo-element, which
// extends this many px beyond the element on every side (inset: -20px in
// index.css). The map must cover that whole area — any uncovered region reads
// as transparent black in feDisplacementMap, i.e. a uniform -scale/2 shift.
export const GLASS_OVERSCAN = 20

interface GlassMapOptions {
  bezelWidth?: number      // px of rim that refracts (flat glass beyond it)
  thickness?: number       // glass slab thickness in px
  refractiveIndex?: number // n₂ of the glass; air n₁ = 1 is implied
}

// Fixed light direction for the specular rim: from above, slightly left
// (screen coords, y down). Unit-normalized below.
const LIGHT_LEN = Math.hypot(0.45, 0.89)
const LIGHT_X = -0.45 / LIGHT_LEN
const LIGHT_Y = -0.89 / LIGHT_LEN
const SPECULAR_OPACITY = 0.5
const COUNTER_LIGHT = 0.4 // relative strength of the opposite-rim highlight

function specularAlpha(ox: number, oy: number, rim: number): number {
  // Rim light: intensity from the outward normal's alignment with the light,
  // plus a weaker counter-highlight on the opposite rim.
  const dot = ox * LIGHT_X + oy * LIGHT_Y
  const lit = dot > 0 ? dot ** 3 : COUNTER_LIGHT * (-dot) ** 3
  return Math.round(255 * Math.min(1, rim * lit) * SPECULAR_OPACITY)
}

// Displacement magnitude for each distance into the bezel, precomputed on a
// single radius (the map is radially symmetric around the shape's edge).
// Height profile: convex squircle y = ⁴√(1 − (1−u)⁴). A vertical ray hits the
// tilted surface (θᵢ from the slope), refracts per Snell's law, then travels
// down through the glass under that point — the lateral offset is the
// displacement. Peaks in a thin band at the edge, zero where the slab is flat.
function refractionProfile(
  bezel: number,
  thickness: number,
  n2: number,
  samples = 256
): { mags: Float32Array; max: number } {
  const mags = new Float32Array(samples)
  let max = 0
  for (let i = 0; i < samples; i++) {
    const u = i / (samples - 1)
    const om = 1 - u
    const y = Math.pow(1 - om ** 4, 0.25)
    if (y === 0) continue
    const dydu = om ** 3 * Math.pow(1 - om ** 4, -0.75)
    const thetaI = Math.atan((thickness / bezel) * dydu)
    const thetaT = Math.asin(Math.sin(thetaI) / n2)
    const s = thickness * y * Math.tan(thetaI - thetaT)
    mags[i] = s
    if (s > max) max = s
  }
  return { mags, max }
}

// Signed distance field for a rounded rectangle.
// Returns negative inside, 0 at edge, positive outside.
function sdfRoundRect(
  px: number, py: number,
  hw: number, hh: number,  // half-width, half-height
  r: number                // border radius
): number {
  const qx = Math.abs(px) - hw + r
  const qy = Math.abs(py) - hh + r
  return Math.sqrt(Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2) + Math.min(Math.max(qx, qy), 0) - r
}

export function generateGlassMap(
  width: number,
  height: number,
  borderRadius: number,
  { bezelWidth = 20, thickness = 30, refractiveIndex = 1.5 }: GlassMapOptions = {}
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
      // neutral displacement, no highlight.
      if (edgeDist <= 0 || u >= 1) {
        d[i] = 128; d[i + 1] = 128; d[i + 2] = 0; d[i + 3] = 255
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
      d[i + 2] = specularAlpha(ox, oy, strength)
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

// Builds displacement + specular maps from an arbitrary alpha mask (e.g. the
// logo letterforms) instead of a rounded rect. The mask is drawn into a canvas
// padded by GLASS_OVERSCAN, its alpha is blurred, and the alpha gradient —
// which points into the shape, matching the inward displacement of the rect
// maps — provides both the displacement direction and the rim normals.
export function generateMaskGlassMap(
  width: number,
  height: number,
  drawMask: (ctx: CanvasRenderingContext2D) => void,
  { blurRadius = 3, scale = 30 }: { blurRadius?: number; scale?: number } = {}
): GlassMaps {
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
      d[i + 3] = 255

      const mag = Math.hypot(nx, ny)
      d[i + 2] = mag > 0.05 ? specularAlpha(-nx / mag, -ny / mag, mag) : 0
    }
  }

  ctx.putImageData(img, 0, 0)
  return { url: canvas.toDataURL(), scale }
}
