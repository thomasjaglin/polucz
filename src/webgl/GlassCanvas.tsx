import { useEffect, useRef } from 'react'
import type { PageId } from '../data/types'
import { getPanes, onPanesChanged, getMaskPanes, onPokeRenderer, getBgBlobTop, onBgChange, type PaneRecord } from './glassStore'
import { fx, onFxChange, isAnimated } from './shaderFx'
import { resolvePageUniforms, MAX_ELLIPSES, MAX_LAYERS } from './backgroundData'
import {
  BEZEL_WIDTH,
  THICKNESS,
  REFRACTIVE_INDEX,
  BACKDROP_BLUR_PX,
  BACKDROP_SATURATION,
  LIGHT_X,
  LIGHT_Y,
  SPECULAR_OPACITY,
  COUNTER_LIGHT,
  SPECULAR_EXPONENT,
  refractionProfile,
} from '../lib/glassParams'

const MAX_PANES = 48
// Free-form mask panes (logo letterforms, gooey nav, translate-page blob, ...)
// each need their own prebaked texture, so the budget is small and fixed —
// bump alongside the texture units wired up below if a third is ever needed.
const MAX_MASK_PANES = 2

// Fullscreen triangle from gl_VertexID — no vertex buffers needed.
const VERT = `#version 300 es
void main() {
  vec2 pos = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}`

// Pass 1 — the page background: base color, then the
// per-page blurred ellipse stacks screen-blended on top (mirrors the DOM
// layers in AppBackground.tsx / PageGradient.tsx).
const BG_FRAG = `#version 300 es
precision highp float;
uniform vec2 uResCss;
uniform float uDpr;
uniform int uEllipseCount;
uniform vec4 uEllGeo[${MAX_ELLIPSES}];   // cx, cy, rx, ry (css px)
uniform vec4 uEllMisc[${MAX_ELLIPSES}];  // sinθ, cosθ, layerIndex, unused
uniform vec3 uEllColor[${MAX_ELLIPSES}];
uniform vec2 uLayerParams[${MAX_LAYERS}]; // opacity, blurPx
// Optional elliptical clip (translate blob → circle disc): cx, cy, rx, ry in
// css px. rx <= 0 disables it.
uniform vec4 uClip;
out vec4 outColor;

const vec3 BASE = vec3(18.0 / 255.0);   // body #121212

// smoothstep with descending edges is undefined behavior in GLSL —
// this is the explicit, any-order-safe equivalent.
float fallStep(float hi, float lo, float x) {
  float t = clamp((x - hi) / (lo - hi), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

// Approximate signed distance (px) to an ellipse rotated by θ about its center.
float ellipseDist(vec2 p, vec4 geo, vec2 sc) {
  vec2 v = p - geo.xy;
  // rotate by -θ (sc = vec2(sinθ, cosθ))
  v = vec2(v.x * sc.y + v.y * sc.x, -v.x * sc.x + v.y * sc.y);
  vec2 r = geo.zw;
  vec2 vr = v / r;
  float f = dot(vr, vr);
  vec2 g = 2.0 * v / (r * r);
  return (f - 1.0) / max(length(g), 1e-4);
}

void main() {
  vec2 css = vec2(gl_FragCoord.x / uDpr, uResCss.y - gl_FragCoord.y / uDpr);
  vec3 col = BASE;

  // Elliptical clip factor (1 inside, soft-edged to 0 outside). Confines the
  // translate blob to the circle disc so it doesn't glow past the ellipse.
  float clip = 1.0;
  if (uClip.z > 0.0) {
    vec2 dd = (css - uClip.xy) / uClip.zw;
    clip = 1.0 - fallStep(0.9, 1.02, length(dd));
  }

  // Ellipse stacks: src-over within a layer (premultiplied), screen-blend
  // each layer onto the base with its opacity.
  vec3 acc = vec3(0.0);
  float accA = 0.0;
  int curLayer = 0;
  for (int i = 0; i < ${MAX_ELLIPSES}; i++) {
    if (i >= uEllipseCount) break;
    int layer = int(uEllMisc[i].z + 0.5);
    if (layer != curLayer) {
      vec3 lc = acc / max(accA, 1e-4);
      float a = accA * uLayerParams[curLayer].x * clip;
      col = mix(col, 1.0 - (1.0 - col) * (1.0 - lc), a);
      acc = vec3(0.0); accA = 0.0; curLayer = layer;
    }
    // Gaussian blur(r) has σ = r/2 — a ±σ·1.5 hermite band approximates it
    float blur = uLayerParams[layer].y * 0.75;
    float d = ellipseDist(css, uEllGeo[i], uEllMisc[i].xy);
    float m = fallStep(blur, -blur, d);
    acc = mix(acc, uEllColor[i], m);
    accA = mix(accA, 1.0, m);
  }
  vec3 lc = acc / max(accA, 1e-4);
  float a = accA * uLayerParams[curLayer].x * clip;
  col = mix(col, 1.0 - (1.0 - col) * (1.0 - lc), a);

  outColor = vec4(col, 1.0);
}`

// Pass 2 — composite: glass panes refract, blur, saturate and rim-light the
// background texture. Same math as generateGlassMap.ts, evaluated per pixel.
const COMPOSITE_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uBg;
uniform vec2 uResCss;
uniform float uDpr;
uniform int uPaneCount;
uniform vec4 uPane[${MAX_PANES}];        // x, y, w, h (css px, top-left, un-rotated)
uniform float uPaneRadius[${MAX_PANES}];
uniform float uPaneAngle[${MAX_PANES}];  // z-rotation, radians (tilted cards)
uniform float uBezel;
uniform float uThick;
uniform float uN2;
uniform float uMaxDisp;                  // profile max (px) for rim normalization
uniform float uBlurPx;
uniform float uSaturation;
uniform vec2 uLight;
uniform float uSpecOpacity;
uniform float uCounterLight;
uniform float uSpecExponent;
// Experimental FX (see shaderFx.ts / the glass lab)
uniform float uChroma;
uniform float uFresnel;
uniform float uWobble;
uniform float uTime;
// Free-form mask glass (logo letterforms, gooey nav, translate blob, ...):
// each registered shape gets its own prebaked displacement/specular map.
// Two explicitly named samplers rather than a sampler2D[2] array — dynamic
// (loop-variable) indexing of sampler arrays is technically legal GLSL ES
// 3.00 but unreliable across real WebGL2 drivers (notably ANGLE/D3D11 on
// Windows Chrome), so this avoids it entirely at the cost of a fixed cap.
uniform int uMaskCount;
uniform sampler2D uMask0;
uniform sampler2D uMask1;
uniform vec4 uMaskRect[${MAX_MASK_PANES}];   // overscanned rect, css px
uniform float uMaskScale[${MAX_MASK_PANES}];
out vec4 outColor;

float sdRoundRect(vec2 p, vec2 halfSize, float r) {
  vec2 q = abs(p) - halfSize + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// Rotate a center-relative point into the pane's un-rotated (local) frame:
// rotate by -angle. ca/sa are cos/sin of the pane's angle.
vec2 toLocal(vec2 p, float ca, float sa) {
  return vec2(p.x * ca + p.y * sa, -p.x * sa + p.y * ca);
}
// Inverse: local vector -> screen frame (rotate by +angle).
vec2 toScreen(vec2 p, float ca, float sa) {
  return vec2(p.x * ca - p.y * sa, p.x * sa + p.y * ca);
}

// smoothstep with descending edges is undefined behavior in GLSL
float fallStep(float hi, float lo, float x) {
  float t = clamp((x - hi) / (lo - hi), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

// Snell displacement through the convex-squircle bezel (kube.io model)
float dispMag(float u) {
  u = clamp(u, 1e-3, 1.0);
  float om = 1.0 - u;
  float b = 1.0 - om * om * om * om;
  float y = pow(b, 0.25);
  float dydu = om * om * om * pow(b, -0.75);
  float thetaI = atan(uThick / uBezel * dydu);
  float thetaT = asin(sin(thetaI) / uN2);
  return uThick * y * tan(thetaI - thetaT);
}

// Mask glass (gooey nav, translate blob, ...): displacement + relief from a
// registered shape's prebaked map, exactly like feDisplacementMap (offset =
// scale · (C − 0.5); B is signed relief: above 0.5 = white highlight, below
// = black shade). Blur + saturation match the rect panes, and the map is
// neutral outside the silhouette so only the shape frosts. Returns false if
// this pixel isn't covered by the shape.
bool sampleMask(sampler2D tex, vec4 mr, float mscale, vec2 css, float blurPx, float dpr, vec2 resCss, float saturation, out vec3 outCol, out float outCov) {
  if (css.x < mr.x || css.y < mr.y || css.x >= mr.x + mr.z || css.y >= mr.y + mr.w) return false;
  vec2 muv = (css - mr.xy) / mr.zw;
  vec4 m = texture(tex, muv);
  float cov = m.a; // shape coverage (crisp, canvas-antialiased)
  if (cov <= 0.01) return false;
  float hl = max(2.0 * m.b - 1.0, 0.0);
  float sh = max(1.0 - 2.0 * m.b, 0.0);
  vec2 mcss = css + mscale * (m.rg - vec2(128.0 / 255.0));
  vec2 muv2 = vec2(mcss.x / resCss.x, 1.0 - mcss.y / resCss.y);
  float mlod = log2(max(blurPx * dpr, 2.0)) - 1.0;
  vec3 mc = textureLod(uBg, muv2, mlod).rgb;
  float mluma = dot(mc, vec3(0.2126, 0.7152, 0.0722));
  mc = clamp(mix(vec3(mluma), mc, saturation), 0.0, 1.0);
  mc = 1.0 - (1.0 - mc) * (1.0 - hl); // screen white
  mc *= 1.0 - sh;                     // darken
  outCol = mc;
  outCov = cov;
  return true;
}

void main() {
  vec2 css = vec2(gl_FragCoord.x / uDpr, uResCss.y - gl_FragCoord.y / uDpr);
  vec4 bg0 = texelFetch(uBg, ivec2(gl_FragCoord.xy), 0);

  // Smallest rect pane containing this pixel wins (inner pane over outer pane —
  // e.g. tag pill sitting on a card). Rect panes are checked BEFORE mask shapes
  // so small UI elements (the translate input/buttons) stay glassy on top of a
  // large mask (the translate circle) they overlap.
  int hit = -1;
  float hitD = 0.0;
  float hitArea = 1e12;
  for (int i = 0; i < ${MAX_PANES}; i++) {
    if (i >= uPaneCount) break;
    vec4 r = uPane[i];
    float a = uPaneAngle[i];
    vec2 lp = css - r.xy - r.zw * 0.5;               // relative to pane center
    if (a != 0.0) lp = toLocal(lp, cos(a), sin(a));  // into the pane's un-rotated frame
    float d = sdRoundRect(lp, r.zw * 0.5, min(uPaneRadius[i], min(r.z, r.w) * 0.5));
    float area = r.z * r.w;
    if (d < 1.0 && area < hitArea) { hit = i; hitD = d; hitArea = area; }
  }
  // No rect pane here — fall back to mask shapes (logo letterforms, translate
  // circle). First registered mask whose rect contains this pixel wins.
  if (hit < 0) {
    vec3 maskCol; float maskCov;
    if (uMaskCount > 0 && sampleMask(uMask0, uMaskRect[0], uMaskScale[0], css, uBlurPx, uDpr, uResCss, uSaturation, maskCol, maskCov)) {
      outColor = vec4(mix(bg0.rgb, maskCol, maskCov), 1.0);
      return;
    }
    if (uMaskCount > 1 && sampleMask(uMask1, uMaskRect[1], uMaskScale[1], css, uBlurPx, uDpr, uResCss, uSaturation, maskCol, maskCov)) {
      outColor = vec4(mix(bg0.rgb, maskCol, maskCov), 1.0);
      return;
    }
    outColor = vec4(bg0.rgb, 1.0);
    return;
  }

  vec4 r = uPane[hit];
  vec2 halfSize = r.zw * 0.5;
  float rad = min(uPaneRadius[hit], min(halfSize.x, halfSize.y));
  float pa = uPaneAngle[hit];
  float pca = cos(pa), psa = sin(pa);
  // Work in the pane's un-rotated (local) frame; the SDF and its gradient are
  // computed there, then the outward normal is rotated back to screen space
  // so refraction offset + rim light stay correct on a tilted card.
  vec2 lp = css - r.xy - halfSize;
  if (pa != 0.0) lp = toLocal(lp, pca, psa);
  float edgeDist = -hitD;
  float u = edgeDist / uBezel;

  vec2 disp = vec2(0.0);
  float rim = 0.0;
  vec2 outward = vec2(0.0);
  if (edgeDist > 0.0 && u < 1.0) {
    float e = 0.5;
    vec2 grad = vec2(
      sdRoundRect(lp + vec2(e, 0.0), halfSize, rad) - sdRoundRect(lp - vec2(e, 0.0), halfSize, rad),
      sdRoundRect(lp + vec2(0.0, e), halfSize, rad) - sdRoundRect(lp - vec2(0.0, e), halfSize, rad)
    ) / (2.0 * e);
    outward = normalize(grad);
    if (pa != 0.0) outward = toScreen(outward, pca, psa); // local normal -> screen
    // Liquid wobble: slow noise perturbing the surface normal at the bezel
    if (uWobble > 0.001) {
      float ph = uTime * 1.8 + css.x * 0.10 + css.y * 0.13;
      vec2 n2 = vec2(sin(ph), cos(ph * 0.83 + css.x * 0.05));
      outward = normalize(outward + uWobble * 0.35 * n2);
    }
    float s = dispMag(u);
    rim = s / uMaxDisp;
    disp = -outward * s;  // inward — bends the backdrop in at the edges
  }

  // CSS blur(r) is a gaussian with σ = r/2; a mip texel footprint of ~2σ
  // matches it best: lod = log2(blur · dpr) − 1
  float lod = log2(max(uBlurPx * uDpr, 2.0)) - 1.0;
  vec2 sampleCss = css + disp;
  vec2 uv = vec2(sampleCss.x / uResCss.x, 1.0 - sampleCss.y / uResCss.y);
  vec3 c;
  if (uChroma > 0.001 && rim > 0.0) {
    // Chromatic aberration: red and blue refract slightly differently
    vec2 cssR = css + disp * (1.0 + 0.14 * uChroma);
    vec2 cssB = css + disp * (1.0 - 0.14 * uChroma);
    vec2 uvR = vec2(cssR.x / uResCss.x, 1.0 - cssR.y / uResCss.y);
    vec2 uvB = vec2(cssB.x / uResCss.x, 1.0 - cssB.y / uResCss.y);
    c = vec3(textureLod(uBg, uvR, lod).r, textureLod(uBg, uv, lod).g, textureLod(uBg, uvB, lod).b);
  } else {
    c = textureLod(uBg, uv, lod).rgb;
  }

  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = clamp(mix(vec3(luma), c, uSaturation), 0.0, 1.0);

  // Fresnel: edges reflect a fake environment (bright sky above, dark below)
  if (uFresnel > 0.001) {
    float fr = pow(1.0 - clamp(edgeDist / uBezel, 0.0, 1.0), 2.0);
    vec3 env = mix(vec3(0.92, 0.95, 1.0), vec3(0.10, 0.10, 0.14), clamp(css.y / uResCss.y, 0.0, 1.0));
    c = mix(c, env, uFresnel * fr * 0.45);
  }

  if (rim > 0.0) {
    float dl = dot(outward, uLight);
    float lit = dl > 0.0 ? pow(dl, uSpecExponent) : uCounterLight * pow(-dl, uSpecExponent);
    float specA = min(1.0, rim * lit) * uSpecOpacity;
    c = 1.0 - (1.0 - c) * (1.0 - specA);  // screen-blend white
  }

  float cov = fallStep(0.75, -0.75, hitD);
  outColor = vec4(mix(bg0.rgb, c, cov), 1.0);
}`

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(`glass shader: ${gl.getShaderInfoLog(sh)}`)
  }
  return sh
}

function link(gl: WebGL2RenderingContext, frag: string): WebGLProgram {
  const prog = gl.createProgram()!
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT))
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, frag))
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`glass program: ${gl.getProgramInfoLog(prog)}`)
  }
  return prog
}

interface Props {
  activeId: PageId
  onFallback: () => void
}

export default function GlassCanvas({ activeId, onFallback }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const setPageRef = useRef<(id: PageId) => void>(() => {})

  useEffect(() => {
    const canvasEl = canvasRef.current
    if (!canvasEl) return
    const canvas: HTMLCanvasElement = canvasEl

    // preserveDrawingBuffer stays OFF: it forces a framebuffer copy on every
    // composited frame (a real cost on mobile). We always draw full frames,
    // so the cleared-after-present drawing buffer is never visible. Flip to
    // true temporarily when readPixels-based debugging is needed.
    const glCtx = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: false })
    if (!glCtx) { onFallback(); return }
    const gl: WebGL2RenderingContext = glCtx

    let bgProg: WebGLProgram
    let compProg: WebGLProgram
    try {
      bgProg = link(gl, BG_FRAG)
      compProg = link(gl, COMPOSITE_FRAG)
    } catch (err) {
      console.error(err)
      onFallback()
      return
    }
    const bgU = (n: string) => gl.getUniformLocation(bgProg, n)
    const compU = (n: string) => gl.getUniformLocation(compProg, n)

    // Sampler-to-texture-unit assignment is fixed for the program's
    // lifetime — set once rather than every frame. uBg lives on unit 0.
    gl.useProgram(compProg)
    gl.uniform1i(compU('uBg'), 0)
    gl.uniform1i(compU('uMask0'), 1)
    gl.uniform1i(compU('uMask1'), 2)

    const bgTex = gl.createTexture()!
    const fbo = gl.createFramebuffer()!
    gl.bindTexture(gl.TEXTURE_2D, bgTex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    const { max: maxDisp } = refractionProfile(BEZEL_WIDTH, THICKNESS, REFRACTIVE_INDEX)

    // Mask glass (nav, translate blob, ...) textures — each slot uploaded
    // independently when its registered map changes
    const maskTextures: WebGLTexture[] = []
    for (let i = 0; i < MAX_MASK_PANES; i++) {
      const tex = gl.createTexture()!
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      maskTextures.push(tex)
    }
    const maskUploaded: (HTMLCanvasElement | null)[] = new Array(MAX_MASK_PANES).fill(null)
    const maskRects = new Float32Array(MAX_MASK_PANES * 4)
    const maskScales = new Float32Array(MAX_MASK_PANES)
    let maskCount = 0

    const tiltRef = { gamma: null as number | null, beta: null as number | null }
    let page: PageId = activeId
    let bgDirty = true
    let sceneDirty = true
    let lastActivity = performance.now()
    let lastSig = 0
    let frame = 0
    let raf = 0
    let dead = false

    // Cached viewport size + dpr — refreshed only when a resize actually fires,
    // so the tick loop reads no layout properties (clientWidth/Height) at rest.
    let cssW = 0
    let cssH = 0
    let cssDpr = 1
    let resizeDirty = true

    const paneRect = new Float32Array(MAX_PANES * 4)
    const paneRadius = new Float32Array(MAX_PANES)
    const paneAngle = new Float32Array(MAX_PANES) // z-rotation, radians

    function markActive() {
      lastActivity = performance.now()
      sceneDirty = true
    }

    // Reads layout (clientWidth/Height) — called only when a resize actually
    // happened, then caches the result so renders reuse it without re-reading.
    function updateSize(): boolean {
      cssDpr = Math.min(window.devicePixelRatio || 1, 2)
      cssW = canvas.clientWidth
      cssH = canvas.clientHeight
      const w = Math.round(cssW * cssDpr)
      const h = Math.round(cssH * cssDpr)
      if (w === canvas.width && h === canvas.height) return false
      canvas.width = w
      canvas.height = h
      gl.bindTexture(gl.TEXTURE_2D, bgTex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      return true
    }

    function renderBg() {
      const vw = cssW, vh = cssH, dpr = cssDpr
      const u = resolvePageUniforms(page, vw, vh, getBgBlobTop())
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, bgTex, 0)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.useProgram(bgProg)
      gl.uniform2f(bgU('uResCss'), vw, vh)
      gl.uniform1f(bgU('uDpr'), dpr)
      gl.uniform1i(bgU('uEllipseCount'), u.count)
      gl.uniform4fv(bgU('uEllGeo'), u.geo)
      gl.uniform4fv(bgU('uEllMisc'), u.misc)
      gl.uniform3fv(bgU('uEllColor'), u.color)
      gl.uniform2fv(bgU('uLayerParams'), u.layerParams)
      gl.uniform4fv(bgU('uClip'), u.clip)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.bindTexture(gl.TEXTURE_2D, bgTex)
      gl.generateMipmap(gl.TEXTURE_2D)
    }

    // Reads live rects; returns a numeric signature so the loop can skip
    // recompositing when nothing moved. Panes fully outside the viewport are
    // skipped, so long scrolling lists can't starve the visible ones out of
    // the MAX_PANES uniform budget.
    //
    // Rects are extrapolated by fx.lead frames of their measured velocity:
    // the DOM is moved by the compositor (touch scroll, drags) ahead of what
    // the main thread reads, so the un-predicted glass visibly trails its
    // element. Velocity is EMA-smoothed; jumps are treated as teleports.
    const rectHist = new WeakMap<object, { x: number; y: number; vx: number; vy: number; t: number }>()
    function predictPoint(key: object, px: number, py: number, now: number): { x: number; y: number } {
      const h = rectHist.get(key)
      let vx = 0
      let vy = 0
      if (h) {
        const dt = now - h.t
        if (dt > 0 && dt < 100) {
          const ix = (px - h.x) / dt
          const iy = (py - h.y) / dt
          // >5px/ms is a teleport (page switch, remount) — don't predict
          if (Math.abs(ix) < 5 && Math.abs(iy) < 5) {
            vx = h.vx * 0.4 + ix * 0.6
            vy = h.vy * 0.4 + iy * 0.6
          }
        }
      }
      rectHist.set(key, { x: px, y: py, vx, vy, t: now })
      const lead = fx.lead * 16.7
      return { x: px + vx * lead, y: py + vy * lead }
    }

    // Only panes near the viewport are measured each frame: an
    // IntersectionObserver tracks which registered panes are close enough to
    // matter, so a long scrolling list doesn't pay a getBoundingClientRect per
    // off-screen card. New panes start optimistically visible (measured once)
    // until the observer reports on them.
    const visiblePanes = new Set<PaneRecord>()
    const observedEls = new Map<HTMLElement, PaneRecord>()
    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          const rec = observedEls.get(e.target as HTMLElement)
          if (!rec) continue
          if (e.isIntersecting) visiblePanes.add(rec)
          else visiblePanes.delete(rec)
        }
        markActive()
      },
      { rootMargin: '200px' },
    )
    function syncPaneObservers() {
      const current = getPanes()
      for (const [el, rec] of observedEls) {
        if (!current.has(rec)) {
          io.unobserve(el)
          observedEls.delete(el)
          visiblePanes.delete(rec)
        }
      }
      for (const rec of current) {
        if (!observedEls.has(rec.el)) {
          observedEls.set(rec.el, rec)
          visiblePanes.add(rec)
          io.observe(rec.el)
        }
      }
    }

    function readPanes(): { count: number; sig: number } {
      let i = 0
      let sig = 7
      const hash = (v: number) => { sig = (sig * 31 + Math.round(v * 4)) | 0 }
      const now = performance.now()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const M = 40 // off-screen margin — panes partially entering keep glass

      for (const p of visiblePanes) {
        if (i >= MAX_PANES) break
        const r = p.el.getBoundingClientRect()
        if (r.width < 2 || r.height < 2) continue
        if (r.bottom < -M || r.top > vh + M || r.right < -M || r.left > vw + M) continue
        // getBoundingClientRect gives the AXIS-ALIGNED bounding box, which for
        // a tilted (rotated) card is larger and upright. Use the element's
        // un-rotated layout size + the live angle so the shader can draw the
        // glass rotated to match; the bbox center is the rotation center, so
        // predict that. Non-rotated panes: angle 0, bbox == layout box.
        const angle = p.getRotation ? p.getRotation() : 0
        const w = angle !== 0 ? p.el.offsetWidth : r.width
        const h = angle !== 0 ? p.el.offsetHeight : r.height
        const pc = predictPoint(p, r.left + r.width / 2, r.top + r.height / 2, now)
        paneRect[i * 4] = pc.x - w / 2
        paneRect[i * 4 + 1] = pc.y - h / 2
        paneRect[i * 4 + 2] = w
        paneRect[i * 4 + 3] = h
        paneRadius[i] = p.borderRadius
        paneAngle[i] = angle
        hash(pc.x); hash(pc.y); hash(w); hash(h); hash(angle * 100)
        i++
      }

      let m = 0
      for (const mp of getMaskPanes()) {
        if (m >= MAX_MASK_PANES) break
        const r = mp.el.getBoundingClientRect()
        if (r.width < 2 || r.height < 2) continue
        maskRects[m * 4]     = r.left - mp.overscan
        maskRects[m * 4 + 1] = r.top - mp.overscan
        maskRects[m * 4 + 2] = r.width + mp.overscan * 2
        maskRects[m * 4 + 3] = r.height + mp.overscan * 2
        maskScales[m] = mp.scale
        hash(maskRects[m * 4]); hash(maskRects[m * 4 + 1])
        if (maskUploaded[m] !== mp.map) {
          gl.bindTexture(gl.TEXTURE_2D, maskTextures[m])
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, mp.map)
          maskUploaded[m] = mp.map
        }
        m++
      }
      maskCount = m
      hash(maskCount)

      return { count: i, sig }
    }

    function renderComposite(count: number) {
      const vw = cssW, vh = cssH, dpr = cssDpr
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.useProgram(compProg)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, bgTex)
      gl.uniform1i(compU('uBg'), 0)
      gl.uniform2f(compU('uResCss'), vw, vh)
      gl.uniform1f(compU('uDpr'), dpr)
      gl.uniform1i(compU('uPaneCount'), count)
      gl.uniform4fv(compU('uPane'), paneRect)
      gl.uniform1fv(compU('uPaneRadius'), paneRadius)
      gl.uniform1fv(compU('uPaneAngle'), paneAngle)
      gl.uniform1f(compU('uBezel'), BEZEL_WIDTH)
      gl.uniform1f(compU('uThick'), THICKNESS)
      gl.uniform1f(compU('uN2'), REFRACTIVE_INDEX)
      gl.uniform1f(compU('uMaxDisp'), maxDisp)
      gl.uniform1f(compU('uBlurPx'), BACKDROP_BLUR_PX)
      gl.uniform1f(compU('uSaturation'), BACKDROP_SATURATION)
      // Light direction: static default, slow drift, or device tilt
      let angle = fx.lightAngle
      if (fx.autoLight) angle += Math.sin(performance.now() / 1000 * 0.5) * 0.9
      if (fx.tiltLight && tiltRef.gamma !== null) {
        const gx = Math.max(-1, Math.min(1, tiltRef.gamma / 45))
        const gy = Math.max(-1, Math.min(1, ((tiltRef.beta ?? 45) - 45) / 45))
        angle = Math.atan2(-1 + gy * 0.8, gx)
      }
      gl.uniform2f(compU('uLight'), Math.cos(angle), Math.sin(angle))
      gl.uniform1f(compU('uSpecOpacity'), SPECULAR_OPACITY)
      gl.uniform1f(compU('uCounterLight'), COUNTER_LIGHT)
      gl.uniform1f(compU('uSpecExponent'), SPECULAR_EXPONENT)
      gl.uniform1f(compU('uChroma'), fx.chroma)
      gl.uniform1f(compU('uFresnel'), fx.fresnel)
      gl.uniform1f(compU('uWobble'), fx.wobble)
      gl.uniform1f(compU('uTime'), performance.now() / 1000)
      for (let i = 0; i < MAX_MASK_PANES; i++) {
        gl.activeTexture(gl.TEXTURE1 + i)
        gl.bindTexture(gl.TEXTURE_2D, maskTextures[i])
      }
      gl.uniform1i(compU('uMaskCount'), maskCount)
      gl.uniform4fv(compU('uMaskRect'), maskRects)
      gl.uniform1fv(compU('uMaskScale'), maskScales)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    function tick() {
      if (dead) return
      raf = requestAnimationFrame(tick)
      frame++

      if (resizeDirty) {
        resizeDirty = false
        if (updateSize()) bgDirty = true
      }
      if (bgDirty) {
        renderBg()
        bgDirty = false
        sceneDirty = true
      }

      // Animated FX (wobble / moving light) need continuous re-rendering
      if (isAnimated()) sceneDirty = true

      // While recently active poll rects every frame (covers event-triggered
      // animations — modal, page transitions — at full framerate); once idle,
      // poll every 12th frame as a safety net for CSS transitions we get no
      // events for. Recomposite only when the rect signature actually changes.
      const active = performance.now() - lastActivity < 700
      if (sceneDirty || active || frame % 12 === 0) {
        const { count, sig } = readPanes()
        if (sceneDirty || sig !== lastSig) {
          lastSig = sig
          renderComposite(count)
          sceneDirty = false
        }
      }
    }

    setPageRef.current = (id: PageId) => {
      if (id === page) return
      page = id
      bgDirty = true
      markActive()
    }

    const unsubPanes = onPanesChanged(() => { syncPaneObservers(); markActive() })
    const unsubFx = onFxChange(markActive)
    const unsubPoke = onPokeRenderer(markActive)
    // Translate blob slid to a new position — re-bake the background texture.
    const unsubBg = onBgChange(() => { bgDirty = true; markActive() })
    const onScroll = () => markActive()
    const onResize = () => { resizeDirty = true; markActive() }
    const onLost = (e: Event) => {
      e.preventDefault()
      onFallback()
    }
    const onTilt = (e: DeviceOrientationEvent) => {
      tiltRef.gamma = e.gamma
      tiltRef.beta = e.beta
    }
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    window.addEventListener('resize', onResize)
    window.addEventListener('deviceorientation', onTilt)
    canvas.addEventListener('webglcontextlost', onLost)

    syncPaneObservers()
    raf = requestAnimationFrame(tick)

    return () => {
      dead = true
      cancelAnimationFrame(raf)
      io.disconnect()
      unsubPanes()
      unsubFx()
      unsubPoke()
      unsubBg()
      window.removeEventListener('scroll', onScroll, { capture: true })
      window.removeEventListener('resize', onResize)
      window.removeEventListener('deviceorientation', onTilt)
      canvas.removeEventListener('webglcontextlost', onLost)
      gl.deleteTexture(bgTex)
      maskTextures.forEach(t => gl.deleteTexture(t))
      gl.deleteFramebuffer(fbo)
      gl.deleteProgram(bgProg)
      gl.deleteProgram(compProg)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setPageRef.current(activeId)
  }, [activeId])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      aria-hidden
    />
  )
}
