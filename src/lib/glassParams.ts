// Single source of truth for the liquid-glass look, shared by the SVG path
// (generateGlassMap.ts) and the WebGL path (webgl/GlassCanvas.tsx) so the two
// renderers cannot drift apart. See docs/liquid-glass-webgl-plan.md.

// How far the glass surface extends beyond the element on every side
// (the .kube-glass-bg::before inset in index.css must match).
export const GLASS_OVERSCAN = 20

// Refraction geometry (kube.io model: convex-squircle bezel + Snell's law)
export const BEZEL_WIDTH = 26      // px of rim that refracts; flat glass beyond
                                   // (widened from 20 so large panes like the
                                   // word-detail card show a broader glass
                                   // frame; a wider bezel is a gentler slope,
                                   // so peak displacement actually drops —
                                   // safe for GLASS_OVERSCAN, softer on small
                                   // buttons, which fresnel/specular re-punch)
export const THICKNESS = 30        // glass slab thickness in px
export const REFRACTIVE_INDEX = 1.5 // n₂ of the glass; air n₁ = 1 implied

// Backdrop treatment behind the glass
export const BACKDROP_BLUR_PX = 8
export const BACKDROP_SATURATION = 1.4

// Specular rim light: fixed direction from above, slightly left
// (screen coords, y down), unit-normalized.
const LIGHT_LEN = Math.hypot(0.45, 0.89)
export const LIGHT_X = -0.45 / LIGHT_LEN
export const LIGHT_Y = -0.89 / LIGHT_LEN
export const SPECULAR_OPACITY = 0.62  // rim highlight strength (up from 0.5 to
                                      // make edges read more clearly as glass)
export const COUNTER_LIGHT = 0.4   // relative strength of the opposite-rim highlight
export const SPECULAR_EXPONENT = 3

// Rim light intensity (0..1) for an outward normal and rim strength.
export function specularIntensity(ox: number, oy: number, rim: number): number {
  const dot = ox * LIGHT_X + oy * LIGHT_Y
  const lit = dot > 0 ? dot ** SPECULAR_EXPONENT : COUNTER_LIGHT * (-dot) ** SPECULAR_EXPONENT
  return Math.min(1, rim * lit) * SPECULAR_OPACITY
}

// Displacement magnitude for each distance into the bezel, precomputed on a
// single radius (the map is radially symmetric around the shape's edge).
// Height profile: convex squircle y = ⁴√(1 − (1−u)⁴). A vertical ray hits the
// tilted surface (θᵢ from the slope), refracts per Snell's law, then travels
// down through the glass under that point — the lateral offset is the
// displacement. Peaks in a thin band at the edge, zero where the slab is flat.
export function refractionProfile(
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
export function sdfRoundRect(
  px: number, py: number,
  hw: number, hh: number,  // half-width, half-height
  r: number                // border radius
): number {
  const qx = Math.abs(px) - hw + r
  const qy = Math.abs(py) - hh + r
  return Math.sqrt(Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2) + Math.min(Math.max(qx, qy), 0) - r
}
