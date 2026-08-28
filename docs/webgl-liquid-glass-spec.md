# WebGL Liquid Glass — Implementation Plan & Spec

## Status: Pinned — implement after core feature set is complete

---

## Why this matters

The current glass effect (`kube-glass-bg` CSS class using `backdrop-filter: blur()` +
SVG `feTurbulence`/`feDisplacementMap` on a `::before` pseudo-element) has two known,
unfixed limitations documented since Phase 3 of the React migration:

1. `backdrop-filter: url(#filter)` (SVG reference) is not supported in Chrome, Edge, or
   Android WebView — the displacement/refraction effect is silently ignored, and you get
   plain `blur(16px)` only. Firefox sees the full effect; Chrome/Android do not.
2. Even in Firefox, the SVG displacement approach approximates refraction — it distorts
   the already-blurred pixel layer rather than truly shifting background sample positions
   like a physical lens would.

The WebGL approach described in this spec fixes both problems permanently and cross-browser.

---

## References

| Resource | URL | Purpose |
|---|---|---|
| Primary article | https://zenn.dev/orectic/articles/liquid-glass-webgl-refraction?locale=en | Full GLSL breakdown, step by step |
| Parameter generator | https://codequest.work/generator/liquid-glass-generator/ | Visual tuning tool — exports working OGL code |
| Generator usage guide | https://codequest.work/liquid-glass-generator-tool/ | How to use the generator |
| OGL library | https://github.com/oframe/ogl | Lightweight WebGL library used by the approach |
| OGL CDN | https://cdn.jsdelivr.net/npm/ogl@1.0.11/+esm | Import via ESM, no install needed |
| Inigo Quilez SDF reference | https://iquilezles.org/articles/distfunctions2d/ | The sdRoundRect function used for shape |

---

## How it works (conceptual summary)

The technique replaces per-element CSS glass with a single fullscreen WebGL canvas that
sits behind the entire React UI. For each pixel inside a "glass region," a GLSL fragment
shader samples the background texture at a *shifted* position rather than the pixel's
actual position — this is real lens refraction, not a filter approximation.

Seven layers compose the final glass appearance:

1. **Background texture** — your app's gradient/blob background rendered as a WebGL texture
2. **SDF shape** — Inigo Quilez's `sdRoundRect` defines the glass boundary mathematically,
   giving a continuous signed distance value for every pixel
3. **Edge normal** — numerical gradient of the SDF gives the outward direction at every
   point on the glass edge — this is the direction refraction bends toward
4. **Refraction** — background sampled at `position + normal × curve × strength`
   where `curve` is strongest at edges, zero at center — mimics lens thickness
5. **Chromatic aberration** — R, G, B channels sampled with slightly different offsets
   (R shifted +, B shifted -) for physically correct colour fringing at edges
6. **Multi-tap blur** — 12-direction fixed kernel blur simulates frosted glass
   (CSS blur cannot be used because the background is already a WebGL texture)
7. **Specular highlight** — dot product of the 3D-lifted normal with a light direction
   vector produces edge rim lighting; `smoothstep` anti-aliases the glass boundary

---

## Architecture: how this integrates with your React app

### Current architecture (to be replaced)
```
<AppBackground />          ← CSS gradient + dots
<PageGradient />           ← per-page SVG colour blobs
<VocabCard />              ← each card has .kube-glass-bg CSS class
<WordDetailModal />        ← modal has .kube-glass-bg CSS class
<BottomNav />              ← nav pill has .kube-glass-bg CSS class
```
Glass is per-element, CSS-only, no shared rendering context.

### New architecture
```
<WebGLGlassCanvas />       ← NEW: fullscreen canvas, z-index behind everything
<AppBackground />          ← still exists but feeds texture to canvas
<PageGradient />           ← still exists but feeds texture to canvas
<VocabCard />              ← glass class removed; canvas renders glass here
<WordDetailModal />        ← glass class removed; canvas renders glass here
<BottomNav />              ← glass class removed; canvas renders glass here
```

The WebGL canvas sits at `position: fixed, inset: 0, z-index: 0`. The React UI sits
above it at `z-index: 1+`. Glass elements become transparent (no background, no
backdrop-filter) and register their screen positions with the WebGL layer so it knows
where to render the glass effect.

---

## Glass element registry

The WebGL canvas needs to know the position, size, and border radius of each glass
element at every frame. Implementation: a React context (`GlassRegistryContext`) that
glass components register into on mount and update on resize/scroll.

```typescript
interface GlassElement {
  id: string
  rect: DOMRect           // from getBoundingClientRect()
  borderRadius: number    // in px, matching the element's CSS border-radius
  refraction?: number     // override default refraction strength (optional)
  blur?: number           // override default blur radius (optional)
}

// Each glass component registers itself:
const { register, unregister } = useGlassRegistry()
useEffect(() => {
  const id = register({ rect: ref.current.getBoundingClientRect(), borderRadius: 40 })
  return () => unregister(id)
}, [])
```

On each animation frame, the WebGL canvas iterates registered elements, passes their
rects as uniforms, and renders each glass region in sequence.

---

## Background texture strategy

Your background changes per page (red for vocab list, different colours for quiz/audio
etc.) via the `PageGradient` component. Strategy:

1. Render `<AppBackground />` and `<PageGradient />` to an offscreen `<canvas>` or
   `<div>` that is then `html2canvas`-captured as a texture on page transitions
2. OR (simpler): render the background gradient procedurally inside the GLSL shader
   itself using the same colour values already in `src/data/pages.ts` — this avoids
   any DOM-to-texture capture entirely and is more performant
3. Recommendation: **option 2 (procedural in GLSL)** — avoids the `html2canvas`
   dependency, keeps the background in sync with page state via uniforms, and is
   what the article's generator tool already produces

Pass the active page's gradient colours as WebGL uniforms that update on page transition,
matching the same values already used in the CSS gradient.

---

## DPR handling (critical — do not skip)

The article explicitly flags this as a common trap. All pixel values passed to GLSL
uniforms must be multiplied by `window.devicePixelRatio`. If you pass CSS px values,
the effect looks faint on Retina/high-DPR Android screens.

```javascript
const dpr = Math.min(window.devicePixelRatio, 2)  // cap at 2 to protect performance
renderer.setSize(width, height)
uniforms.uResolution.value = [width * dpr, height * dpr]
uniforms.uGlassHalf.value  = [halfW * dpr, halfH * dpr]
uniforms.uEdge.value       = edgePx * dpr
uniforms.uBlur.value       = blurPx * dpr
```

Cap DPR at 2 — running at 3× DPR (many modern Android phones) triples GPU shader work
for minimal visible improvement and risks frame drops on the card flip animation.

---

## Performance considerations for Android WebView

Your primary target device is Android WebView (the packaged APK). Key constraints:

- **Multi-tap blur taps**: the article uses 12 taps (center + 12 directions). Each tap
  is a texture sample. On mid-range Android, cap at 8 taps if frame rate drops below
  60fps. The visual difference between 8 and 12 taps is marginal on a phone screen.
- **Number of glass elements per frame**: each registered glass element requires one
  full shader pass over its pixel area. Rendering 10 cards simultaneously is more
  expensive than 1 modal. Profile on device before finalising.
- **Animation frames**: the WebGL canvas only needs to re-render when something changes
  (drag, page transition, modal open/close). Use `requestAnimationFrame` with a dirty
  flag rather than continuous rendering — this is the single biggest performance win
  for a mostly-static UI.
- **Canvas DPR cap**: enforce `Math.min(devicePixelRatio, 2)` in the OGL renderer init.

---

## Parameters to tune (use the generator tool first)

Before writing integration code, spend time with the generator at
`codequest.work/generator/liquid-glass-generator/` to find your target values.
Export the OGL snippet — the shader string in the export IS the production shader,
not a prototype.

Parameters to dial in against your app's dark red/black background:

| Parameter | Article uniform | Suggested starting range |
|---|---|---|
| Refraction strength | `uRefraction` | 0.4 – 0.8 |
| Chromatic aberration | `uAberration` | 0.2 – 0.5 |
| Blur radius (px) | `uBlur` | 12 – 20 |
| Edge thickness (px) | `uEdge` | 18 – 30 |
| Specular intensity | `uSpecular` | 0.3 – 0.7 |
| Corner radius (px) | `uRadius` | 40 (matches current `rounded-[40px]`) |

The Figma reference design (node 91-608, established earlier) remains the visual target.
Cross-browser consistency is now achievable, so Chrome on desktop and Android WebView
should both match Firefox.

---

## CSS cleanup after WebGL integration

Once the WebGL canvas is rendering glass correctly, remove:

- `.kube-glass-bg` class definition from `src/index.css` (lines ~80–95)
- The `<LiquidGlassFilter />` component (`src/components/LiquidGlassFilter.tsx`) —
  the SVG `<filter id="kube-liquid-glass">` and `<filter id="kube-displace-only">`
  are no longer needed
- All `backdrop-filter` and `filter: url(#...)` CSS references
- The `::before` pseudo-element glass pattern from `index.css`
- The `-webkit-backdrop-filter` prefixes

Keep: all structural Tailwind classes on glass elements (padding, flex, border-radius,
overflow-hidden etc.) — only the visual glass appearance moves to WebGL.

---

## Build order

1. **Parameter tuning** (no code) — use the generator tool with your background colour
   scheme, export an OGL snippet, save it as `src/webgl/liquidGlassShader.glsl.ts`
   (the exported snippet wraps the GLSL in a JS string constant)

2. **Proof of concept** — create `src/webgl/LiquidGlassCanvas.tsx`, a standalone React
   component that renders ONE glass rectangle (the search bar, easiest shape) using
   the exported OGL snippet. Verify it looks correct on desktop Chrome AND deployed
   on your Android device before touching any other component.

3. **GlassRegistryContext** — implement the registry system so glass components can
   register their positions without tight coupling to the WebGL canvas

4. **Background colour uniforms** — wire the active page's gradient colours from
   `src/data/pages.ts` into the WebGL canvas as uniforms, verify transitions look
   correct on page change

5. **Multi-element rendering** — extend to all glass surfaces: VocabCard, BottomNav
   pills, filter tags. Profile on Android device after each element is added.

6. **Modal glass** — add WordDetailModal registration. This is the most complex because
   the modal animates (flip-in, flip-out) and the glass position changes during the
   animation — the registry needs to update every frame during modal transitions, not
   just on mount.

7. **CSS cleanup** — remove all old glass CSS once WebGL renders all surfaces correctly.
   Do not remove CSS before WebGL is verified — keep both working in parallel during
   the transition so you can roll back cleanly.

8. **Android performance pass** — profile on device, tune tap count and DPR cap if
   needed, verify 60fps during card swipe and modal flip animations.

---

## Rollback strategy

Since you're using git with a clean commit history, the rollback plan is:

- Do all WebGL work on a `feature/webgl-glass` branch, not on `main`
- Keep `kube-glass-bg` CSS intact on `main` until the branch is fully verified
- Merge only when the effect is confirmed working on your Android device at 60fps
- If WebGL proves too expensive on your target device, the CSS fallback on `main`
  remains untouched

---

## Out of scope for this implementation

- Custom glass shapes beyond rounded rectangles (pills, circles) — `sdRoundRect` covers
  all current UI shapes; other shapes require different SDF functions
- Animated glass (morphing shape over time) — not needed for this UI
- Video background texture — your background is static gradients, no video
- Server-side rendering of the WebGL canvas — not possible; WebGL is client-only,
  which is fine since this is a PWA/APK with no SSR
