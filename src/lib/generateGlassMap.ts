interface GlassMapOptions {
  edgeThickness?: number  // px from edge that gets refracted
  scale?: number          // max displacement magnitude (px encoded as 0–255)
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
  { edgeThickness = 40, scale = 60 }: GlassMapOptions = {}
): string {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(width, height)
  const d = img.data

  const hw = width / 2
  const hh = height / 2
  const r = Math.min(borderRadius, hw, hh)
  const eps = 0.5

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = x - hw
      const py = y - hh

      const dist = sdfRoundRect(px, py, hw, hh, r)
      // dist < 0 means inside; edgeDist is how far inside we are
      const edgeDist = -dist

      if (edgeDist <= 0) {
        // Outside element: neutral (no displacement)
        const i = (y * width + x) * 4
        d[i] = 128; d[i + 1] = 128; d[i + 2] = 128; d[i + 3] = 255
        continue
      }

      // Profile: full displacement at edge, zero at center
      const t = Math.min(edgeDist / edgeThickness, 1)
      const strength = (1 - t) ** 2  // quadratic falloff

      // Outward normal via SDF gradient (numerical)
      const gx = (sdfRoundRect(px + eps, py, hw, hh, r) - sdfRoundRect(px - eps, py, hw, hh, r)) / (2 * eps)
      const gy = (sdfRoundRect(px, py + eps, hw, hh, r) - sdfRoundRect(px, py - eps, hw, hh, r)) / (2 * eps)
      // Inward normal (toward center) for refraction — bends background inward at edges
      const len = Math.sqrt(gx * gx + gy * gy) || 1
      const nx = -gx / len
      const ny = -gy / len

      const dx = nx * strength
      const dy = ny * strength

      const i = (y * width + x) * 4
      d[i]     = Math.round(128 + dx * 127)
      d[i + 1] = Math.round(128 + dy * 127)
      d[i + 2] = 128
      d[i + 3] = 255
    }
  }

  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL()
}
