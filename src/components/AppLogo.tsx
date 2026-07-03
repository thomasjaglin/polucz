import { useEffect, useRef } from 'react'
import { generateMaskGlassMap, generateMaskGlassCanvas, GLASS_OVERSCAN } from '../lib/generateGlassMap'
import { upsertFilter } from '../hooks/useGlassFilter'
import { getGlassMode } from '../lib/glassMode'
import { registerMaskPane } from '../webgl/glassStore'

// Scale from original SVG viewBox (142.128 × 58.397) to rendered size (118 × 49)
const LOGO_W = 118
const LOGO_H = 49
const SX = LOGO_W / 142.128
const SY = LOGO_H / 58.397

const LOGO_FILTER_ID = 'kube-glass-logo'

// Bar rect from the SVG: x, y, width, height, rx + rotate(90) pivot
const BAR = { x: 36.3776, y: 50.6733, w: 6.76496, h: 36.3776, rx: 3.38248 }

function drawLogoMask(ctx: CanvasRenderingContext2D) {
  ctx.scale(SX, SY)
  ctx.fillStyle = '#fff'
  for (const d of LETTER_PATHS) ctx.fill(new Path2D(d))
  // Same transform as the SVG rect's rotate(90 cx cy)
  ctx.save()
  ctx.translate(BAR.x, BAR.y)
  ctx.rotate(Math.PI / 2)
  ctx.translate(-BAR.x, -BAR.y)
  ctx.beginPath()
  ctx.roundRect(BAR.x, BAR.y, BAR.w, BAR.h, BAR.rx)
  ctx.fill()
  ctx.restore()
}

const LETTER_PATHS = [
  // U
  'M73.4096 25.1371C73.4096 23.3087 74.8918 21.8265 76.7201 21.8265C78.5485 21.8265 80.0307 23.3087 80.0307 25.1371L80.0307 35.0081C80.0307 39.5136 78.4684 42.8276 75.939 45.1363C73.7444 47.147 70.7686 48.3758 67.4581 48.3758C63.8127 48.3758 60.5022 46.8119 58.196 44.3171C56.1501 42.0829 54.8854 39.0668 54.8854 35.0081L54.8854 25.1557C54.8854 23.317 56.3759 21.8265 58.2146 21.8265C60.0532 21.8265 61.5437 23.3171 61.5437 25.1557L61.5437 35.0081C61.5437 37.2795 62.1761 38.6944 63.1804 39.7743C64.2591 40.9286 65.8214 41.6361 67.4952 41.6361C69.0203 41.6361 70.4338 41.0403 71.4753 40.0722C72.6656 38.9923 73.4096 37.3912 73.4096 35.0081L73.4096 25.1371Z',
  // P
  'M1.64196 1.56462e-05L131.69 1.56462e-05C135.272 1.56462e-05 137.586 1.04647 139.265 2.72826C141.019 4.4848 142.064 6.91406 142.064 9.45544C142.064 11.6978 141.243 13.8281 139.862 15.5099C138.146 17.5654 135.571 18.9109 131.69 18.9109H6.75444V43.3393C6.75444 45.2045 5.24241 46.7165 3.37722 46.7165C1.51203 46.7165 0 45.2045 0 43.3393V1.56969C0 0.523243 0.55976 1.56462e-05 1.64196 1.56462e-05ZM6.75444 12.7069H131.839C133.332 12.7069 134.19 12.2584 134.75 11.511C135.123 11.0251 135.347 10.4271 135.347 9.71705C135.347 8.96958 135.123 8.33424 134.713 7.81102C134.153 7.1383 133.295 6.68982 131.839 6.68982H7.23957C6.94103 6.68982 6.75444 6.83932 6.75444 7.21305V12.7069Z',
  // O (ring with inner cutout — two subpaths, nonzero rule creates the hole)
  'M23.2948 21.8267C30.1678 21.8269 35.7392 27.399 35.7392 34.272C35.739 41.1449 30.1677 46.7162 23.2948 46.7164C16.4218 46.7164 10.8497 41.1451 10.8495 34.272C10.8495 27.3989 16.4217 21.8267 23.2948 21.8267ZM23.2948 28.3365C20.0169 28.3365 17.3593 30.9941 17.3593 34.272C17.3595 37.5499 20.017 40.2066 23.2948 40.2066C26.5725 40.2064 29.2292 37.5497 29.2294 34.272C29.2294 30.9942 26.5726 28.3367 23.2948 28.3365Z',
  // L C Z combined
  'M137.04 21.8267C138.944 21.8268 139.989 22.3847 140.735 23.1656C141.482 23.9467 141.893 24.9886 141.893 25.9185C141.893 26.5881 141.744 27.2209 141.483 27.816C141.221 28.411 140.847 28.9314 139.728 29.7496L126.101 39.8677C125.952 39.9791 125.877 40.0904 125.877 40.2017C125.877 40.3877 126.027 40.5367 126.325 40.5367H133.768V40.526C137.342 40.5261 142.128 43.0403 142.128 49.524C142.128 56.0081 136.427 58.0551 133.64 58.3316C89.6174 58.332 53.4126 58.3969 53.3048 58.397C49.5855 58.397 46.193 57.2494 43.84 54.7066C41.7526 52.4295 40.4621 49.3551 40.4621 45.2183V25.2886C40.4621 23.4128 41.9827 21.8913 43.8585 21.8912C45.7345 21.8912 47.256 23.4127 47.256 25.2886V45.2183C47.256 47.5334 47.9012 48.9761 48.9259 50.0767C50.0265 51.2531 51.5971 51.8873 53.3048 51.8873L133.64 51.8863C134.235 51.8438 136.129 51.4386 136.129 49.524C136.129 47.4824 134.364 47.0352 133.768 46.9713V46.9722H119.942C117.963 46.9722 116.767 46.3026 116.021 45.3355C115.423 44.5544 115.088 43.624 115.088 42.6197C115.088 41.7272 115.424 40.7603 116.17 39.8677C116.506 39.4958 116.954 39.1603 117.925 38.4908L131.477 29.0054C131.551 28.9683 131.589 28.8572 131.589 28.7828C131.589 28.634 131.477 28.4849 131.29 28.4849H97.3556C95.0842 28.4849 93.6689 29.1173 92.589 30.1217C91.4347 31.2004 90.7277 32.7632 90.7277 34.4371C90.7278 35.9619 91.3232 37.3752 92.2912 38.4166C93.371 39.6069 94.9725 40.3511 97.3556 40.3511H107.227C109.055 40.3514 110.537 41.8335 110.537 43.6617C110.537 45.4898 109.055 46.972 107.227 46.9722H97.3556C92.8501 46.9722 89.5353 45.4098 87.2267 42.8804C85.2161 40.6858 83.9874 37.7095 83.9874 34.399C83.9876 30.7539 85.5514 27.4434 88.046 25.1373C90.2802 23.0914 93.2969 21.8267 97.3556 21.8267H137.04Z',
]

export default function AppLogo() {
  // 'css' mode keeps the blur-only fallback below; svg and webgl both get
  // letterform refraction from the same mask-derived map.
  const glassMode = getGlassMode()
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Refraction map built from the letterforms themselves. In svg mode it
  // feeds the shared filter defs; in webgl mode the raw map canvas is
  // registered for the GlassCanvas renderer to sample as a texture.
  useEffect(() => {
    // Lower displacement scale than the panes: the letter strokes are thin,
    // so a large offset would tear the backdrop apart. blurRadius widens the
    // refraction band beyond the stroke edges so it reads at logo size.
    if (glassMode === 'svg') {
      const maps = generateMaskGlassMap(LOGO_W, LOGO_H, drawLogoMask, { scale: 44, blurRadius: 5 })
      upsertFilter(LOGO_FILTER_ID, maps, LOGO_W, LOGO_H)
      return () => {
        document.querySelector(`#kube-glass-filters #${LOGO_FILTER_ID}`)?.remove()
      }
    }
    if (glassMode === 'webgl' && containerRef.current) {
      const { canvas, scale } = generateMaskGlassCanvas(LOGO_W, LOGO_H, drawLogoMask, { scale: 44, blurRadius: 5 })
      return registerMaskPane({ el: containerRef.current, map: canvas, scale, overscan: GLASS_OVERSCAN })
    }
  }, [glassMode])

  return (
    <div ref={containerRef} className="relative" style={{ width: LOGO_W, height: LOGO_H }}>

      {/* Hidden SVG — defines the clip paths scaled to rendered pixel space.
          The -pad variant is shifted by GLASS_OVERSCAN for the oversized
          backdrop layer, whose own origin sits that far up-left. */}
      <svg
        aria-hidden
        style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
      >
        <defs>
          <clipPath id="polucz-clip" clipPathUnits="userSpaceOnUse">
            <g transform={`scale(${SX} ${SY})`}>
              {LETTER_PATHS.map((d, i) => <path key={i} d={d} />)}
              {/* horizontal bar connecting L to rest */}
              <rect x={BAR.x} y={BAR.y} width={BAR.w} height={BAR.h} rx={BAR.rx} transform={`rotate(90 ${BAR.x} ${BAR.y})`} />
            </g>
          </clipPath>
          <clipPath id="polucz-clip-pad" clipPathUnits="userSpaceOnUse">
            <g transform={`translate(${GLASS_OVERSCAN} ${GLASS_OVERSCAN}) scale(${SX} ${SY})`}>
              {LETTER_PATHS.map((d, i) => <path key={i} d={d} />)}
              <rect x={BAR.x} y={BAR.y} width={BAR.w} height={BAR.h} rx={BAR.rx} transform={`rotate(90 ${BAR.x} ${BAR.y})`} />
            </g>
          </clipPath>
        </defs>
      </svg>

      {/* Layer 1 — backdrop blur + displacement, clipped to letter shapes.
          Extends GLASS_OVERSCAN beyond the logo (like .kube-glass-bg::before)
          so edge displacement never samples outside the painted backdrop;
          filter applies before clip-path, so the refraction survives the clip. */}
      {/* Light blur only: at 10px the backdrop flattens to a uniform field and
          the refraction becomes invisible — 3px keeps the dot grid readable
          through the letterforms so the displacement actually shows. */}
      <div
        className="absolute"
        style={{
          inset: -GLASS_OVERSCAN,
          backdropFilter: 'blur(3px) saturate(180%) brightness(110%)',
          WebkitBackdropFilter: 'blur(3px) saturate(180%) brightness(110%)',
          filter: glassMode === 'svg' ? `url(#${LOGO_FILTER_ID})` : undefined,
          clipPath: 'url(#polucz-clip-pad)',
        }}
      />

      {/* Layer 2 — reflection gradient (top-light, like the cards), clipped to letters */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(150deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 55%, rgba(255,255,255,0.10) 100%)',
          clipPath: 'url(#polucz-clip)',
        }}
      />

      {/* Layer 3 — thin edge highlight on letter perimeters (mimics card ring) */}
      <svg
        width={118}
        height={49}
        viewBox="0 0 142.128 58.397"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0"
      >
        <g stroke="white" strokeOpacity="0.25" strokeWidth="1.5" fill="none">
          {LETTER_PATHS.map((d, i) => <path key={i} d={d} />)}
          <rect x="36.3776" y="50.6733" width="6.76496" height="36.3776" rx="3.38248" transform="rotate(90 36.3776 50.6733)" />
        </g>
      </svg>

    </div>
  )
}
