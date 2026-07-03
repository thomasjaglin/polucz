# Liquid Glass — WebGL Rendering Plan

## Goal

Render the liquid-glass effect consistently across browsers. Today the full effect
(refraction + specular, per kube.io/blog/liquid-glass-css-svg) only works in
Chromium, because it relies on SVG `feDisplacementMap` applied alongside
`backdrop-filter`. Safari and Firefox silently degrade to blur-only.

Strategy: **hybrid rendering**.

- **Chromium** keeps the current SVG/CSS pipeline — it refracts *real DOM*
  (modal over cards, logo over header), which WebGL cannot replicate.
- **Safari / Firefox** get a WebGL2 canvas that renders the app background and
  paints the glass surfaces itself — same math, same constants, visually
  identical for background-level panes.
- **No WebGL2 at all** → current blur-only CSS fallback, unchanged.

## Constraint to keep in mind

WebGL cannot sample the page behind the canvas. The WebGL path therefore
refracts only what the shader itself draws: the page gradient + dot grid
(and, in a later phase, other glass surfaces). Panes that sit over DOM content
(word-detail modal, logo) refract the background layer only in WebGL mode.
This is the accepted fidelity trade-off; blur hides most of the difference.

---

## Phase 0 — Baseline & mode selection (S)

- Commit the pending SVG-path work (physical refraction profile, specular rim,
  border-box sizing) so the WebGL work diffs cleanly against it.
- Add `src/lib/glassMode.ts`:
  - `getGlassMode(): 'svg' | 'webgl' | 'css'`
  - Detection: Chromium (SVG filter + backdrop-filter interop known-good) →
    `svg`; else if `WebGL2RenderingContext` available → `webgl`; else `css`.
  - `?glass=svg|webgl|css` URL override for testing and screenshots.

## Phase 1 — Shared parameters module (S)

Extract every tunable from `generateGlassMap.ts` into `src/lib/glassParams.ts`,
consumed by both renderers:

- `GLASS_OVERSCAN`, `bezelWidth`, `thickness`, `refractiveIndex`
- specular: light direction, opacity, counter-light factor, exponent
- backdrop: blur radius (8px), saturation (1.4)

One source of truth means the SVG and WebGL paths cannot drift apart visually.
The refraction profile function (squircle + Snell) moves here too — it is pure
math shared by the map generator (TS) and used to generate reference values for
shader tests.

## Phase 2 — Background canvas (M)

New `GlassCanvas` component mounted once in `App`:

- `position: fixed; inset: 0`, behind all content, `pointer-events: none`.
- WebGL2 context, DPR-aware sizing, `webglcontextlost` handler that flips the
  app back to `css` mode.
- Fragment shader reproduces `AppBackground` / `PageGradient`: per-page gradient
  colors as uniforms (fed from the existing page-theme state) and the procedural
  dot grid.
- When `webgl` mode is active, the CSS background layers are hidden (single
  source of pixels; avoids double-paint mismatch).
- **Exit criterion:** screenshot diff of canvas vs CSS background is
  imperceptible on all pages (allowing minor dithering differences).

## Phase 3 — Pane registry & rect sync (M)

- `useGlassFilter` becomes mode-aware:
  - `svg` mode: current behavior (map generation + filter defs), untouched.
  - `webgl` mode: registers the element in a module-level pane store
    `{ el, borderRadius, layer }` and skips all SVG work.
- A single rAF loop (running only when panes exist and the document scrolled,
  resized, or mutated) reads `getBoundingClientRect()` for registered panes and
  packs them into a uniform array: `vec4(x, y, w, h)` + radius + layer.
- Budget: 32 panes per frame (the app peaks around 15). Offscreen panes
  (IntersectionObserver) are skipped.
- **Known artifact:** rects are read post-layout in the same frame; worst case
  the glass trails scrolling by one frame. Acceptable on the fixed background
  (the refracted content barely changes under translation); revisit only if
  visible.

## Phase 4 — Glass shader (L) → **shippable v1**

Port `generateGlassMap.ts` to GLSL, evaluated per-pixel instead of baked into
8-bit maps:

1. Rounded-rect SDF per pane (same `sdfRoundRect`).
2. Bezel profile: convex squircle + Snell displacement (same
   `refractionProfile` math, computed inline — no 127-sample or 8-bit
   quantization limits).
3. Backdrop sampling: background rendered first into a framebuffer; a cheap
   dual-Kawase blur pass (~2 taps at half res) provides the blurred+saturated
   texture; glass pixels sample it at the refracted coordinate.
4. Specular rim: same outward-normal · light formula, screen-blended.
5. Optional (three lines): chromatic aberration — sample R/G/B at slightly
   different displacement scales. Ship behind a param defaulting off, matching
   the SVG path.

**Exit criterion:** side-by-side with Chrome/SVG on the vocab list page is
visually indistinguishable; 60fps scroll on an iPhone 12-class device.

## Phase 5 — Glass-on-glass (M, optional)

Tag pills sit on cards; in v1 they refract the base background only.
If the difference bothers the eye:

- Give panes a `layer` (derived from GlassPane nesting depth).
- Render layer-0 glass into the framebuffer, then layer-1 panes sample that
  result instead of the raw background.

Descope freely — the pills are 24px tall and mostly blur.

## Phase 6 — Logo in WebGL mode (S, optional)

Reuse `drawLogoMask` to rasterize the letterforms into an alpha texture at
mount; the shader derives normals from the alpha gradient (same math as
`generateMaskGlassMap`). Until then the logo keeps its CSS blur-only fallback
on Safari, which is what it has today — no regression.

## Phase 7 — QA & rollout (M)

- Matrix: Chrome (svg), Safari desktop + iOS (webgl), Firefox (webgl),
  WebGL-less (css). Use the `?glass=` override to force each path in Chrome
  for comparison screenshots.
- Performance: scroll profiling on-device; verify no continuous rAF when idle
  (loop must sleep when nothing is scrolling/animating).
- Memory: iOS Safari canvas limits — one full-screen WebGL2 canvas + one
  half-res FBO is well within limits, but verify on-device.
- Context loss / tab restore: force `loseContext()` in dev, confirm clean
  fallback to `css` mode.

---

## Testing strategy

- **Pure math:** `refractionProfile`, SDF, and specular functions live in
  `glassParams.ts` with unit tests (extend the existing quizLogic test setup).
- **Shader parity:** dev-only harness renders one pane to the canvas, reads
  pixels back (`readPixels`), and compares displacement direction/magnitude at
  sampled edge points against the TS reference within tolerance.
- **Visual:** screenshot comparisons per page per mode, checked manually.

## Risks

| Risk | Mitigation |
| --- | --- |
| Scroll "swim" (1-frame rect lag) | Static fixed background makes it near-invisible; measure before optimizing |
| Double implementation drift | Shared `glassParams.ts`; parity screenshots in QA |
| iOS GPU/battery cost | rAF loop sleeps when idle; blur at half resolution |
| Context loss | Auto-fallback to css mode |
| Dot-grid moiré at fractional DPR | Render dots analytically (distance-based AA) rather than texture tiling |

## Sequencing

Phases 0–4 are the critical path (v1); 5 and 6 are independent follow-ups.
Rough effort: 0+1 in one sitting; 2, 3 a day-ish combined; 4 the main chunk;
7 half a day across devices.
