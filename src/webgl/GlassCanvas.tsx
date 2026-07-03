import { useEffect, useRef } from 'react'
import type { PageId } from '../data/types'
import { getPanes, onPanesChanged, getMaskPane } from './glassStore'
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

const MAX_PANES = 24

// Fullscreen triangle from gl_VertexID — no vertex buffers needed.
const VERT = `#version 300 es
void main() {
  vec2 pos = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}`

// Pass 1 — the page background: base color, dot grid, vignette, then the
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
out vec4 outColor;

const vec3 BASE = vec3(18.0 / 255.0);   // body #121212
const vec3 DOT_COLOR = vec3(217.0 / 255.0);

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

  // Dot grid: 10px tiles, 3px dots, #D9D9D9 @ 0.52
  vec2 tile = mod(css, 10.0) - 5.0;
  float dotA = fallStep(3.4, 2.6, length(tile)) * 0.52;
  vec3 col = mix(BASE, DOT_COLOR, dotA);

  // Vignette: radial-gradient(62% 67.44% at 47.57% 50.05%,
  //   rgba(18,18,18,.99) 62.02%, rgba(18,18,18,.65) 100%)
  vec2 vc = vec2(0.4757, 0.5005) * uResCss;
  vec2 vr = vec2(0.62, 0.6744) * uResCss;
  float t = length((css - vc) / vr);
  // CSS gradients interpolate linearly between stops
  float va = mix(0.99, 0.65, clamp((t - 0.6202) / (1.0 - 0.6202), 0.0, 1.0));
  col = mix(col, BASE, va);

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
      float a = accA * uLayerParams[curLayer].x;
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
  float a = accA * uLayerParams[curLayer].x;
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
uniform vec4 uPane[${MAX_PANES}];        // x, y, w, h (css px, top-left)
uniform float uPaneRadius[${MAX_PANES}];
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
// Free-form mask glass (logo letterforms): prebaked displacement/specular map
uniform sampler2D uMask;
uniform vec4 uMaskRect;   // overscanned rect, css px
uniform float uMaskScale;
uniform int uMaskEnabled;
out vec4 outColor;

float sdRoundRect(vec2 p, vec2 halfSize, float r) {
  vec2 q = abs(p) - halfSize + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
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

void main() {
  vec2 css = vec2(gl_FragCoord.x / uDpr, uResCss.y - gl_FragCoord.y / uDpr);
  vec4 bg0 = texelFetch(uBg, ivec2(gl_FragCoord.xy), 0);

  // Logo letterforms: displacement/specular from the prebaked map, exactly
  // like feDisplacementMap (offset = scale · (C − 0.5), B = rim intensity).
  // No blur here — the DOM layer's clipped backdrop-filter blurs on top.
  if (uMaskEnabled == 1 &&
      css.x >= uMaskRect.x && css.y >= uMaskRect.y &&
      css.x < uMaskRect.x + uMaskRect.z && css.y < uMaskRect.y + uMaskRect.w) {
    vec2 muv = (css - uMaskRect.xy) / uMaskRect.zw;
    vec4 m = texture(uMask, muv);
    vec2 mcss = css + uMaskScale * (m.rg - vec2(128.0 / 255.0));
    vec2 muv2 = vec2(mcss.x / uResCss.x, 1.0 - mcss.y / uResCss.y);
    vec3 mc = textureLod(uBg, muv2, 0.0).rgb;
    mc = 1.0 - (1.0 - mc) * (1.0 - m.b);
    outColor = vec4(mc, 1.0);
    return;
  }

  // Smallest pane containing this pixel wins (inner pane over outer pane —
  // e.g. tag pill sitting on a card).
  int hit = -1;
  float hitD = 0.0;
  float hitArea = 1e12;
  for (int i = 0; i < ${MAX_PANES}; i++) {
    if (i >= uPaneCount) break;
    vec4 r = uPane[i];
    float d = sdRoundRect(css - r.xy - r.zw * 0.5, r.zw * 0.5,
                          min(uPaneRadius[i], min(r.z, r.w) * 0.5));
    float area = r.z * r.w;
    if (d < 1.0 && area < hitArea) { hit = i; hitD = d; hitArea = area; }
  }
  if (hit < 0) { outColor = vec4(bg0.rgb, 1.0); return; }

  vec4 r = uPane[hit];
  vec2 halfSize = r.zw * 0.5;
  float rad = min(uPaneRadius[hit], min(halfSize.x, halfSize.y));
  vec2 lp = css - r.xy - halfSize;
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
    float s = dispMag(u);
    rim = s / uMaxDisp;
    disp = -outward * s;  // inward — bends the backdrop in at the edges
  }

  vec2 sampleCss = css + disp;
  vec2 uv = vec2(sampleCss.x / uResCss.x, 1.0 - sampleCss.y / uResCss.y);
  // CSS blur(r) is a gaussian with σ = r/2; a mip texel footprint of ~2σ
  // matches it best: lod = log2(blur · dpr) − 1
  float lod = log2(max(uBlurPx * uDpr, 2.0)) - 1.0;
  vec3 c = textureLod(uBg, uv, lod).rgb;

  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = clamp(mix(vec3(luma), c, uSaturation), 0.0, 1.0);

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

    // preserveDrawingBuffer: renders are on-demand (not per-frame), so the
    // buffer must survive compositing; also enables pixel-level debugging.
    const glCtx = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true })
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

    const bgTex = gl.createTexture()!
    const fbo = gl.createFramebuffer()!
    gl.bindTexture(gl.TEXTURE_2D, bgTex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    const { max: maxDisp } = refractionProfile(BEZEL_WIDTH, THICKNESS, REFRACTIVE_INDEX)

    // Mask glass (logo) texture — uploaded when the registered map changes
    const maskTex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, maskTex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    let maskUploaded: HTMLCanvasElement | null = null
    const maskRect = new Float32Array(4)
    let maskScale = 0
    let maskEnabled = 0

    let page: PageId = activeId
    let bgDirty = true
    let sceneDirty = true
    let lastActivity = performance.now()
    let lastSig = ''
    let frame = 0
    let raf = 0
    let dead = false

    const paneRect = new Float32Array(MAX_PANES * 4)
    const paneRadius = new Float32Array(MAX_PANES)

    function markActive() {
      lastActivity = performance.now()
      sceneDirty = true
    }

    function resizeIfNeeded(): boolean {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.round(canvas.clientWidth * dpr)
      const h = Math.round(canvas.clientHeight * dpr)
      if (w === canvas.width && h === canvas.height) return false
      canvas.width = w
      canvas.height = h
      gl.bindTexture(gl.TEXTURE_2D, bgTex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      return true
    }

    function cssSize(): [number, number, number] {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      return [canvas.clientWidth, canvas.clientHeight, dpr]
    }

    function renderBg() {
      const [vw, vh, dpr] = cssSize()
      const u = resolvePageUniforms(page, vw, vh)
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
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.bindTexture(gl.TEXTURE_2D, bgTex)
      gl.generateMipmap(gl.TEXTURE_2D)
    }

    // Reads live rects; returns a signature so the loop can skip
    // recompositing when nothing moved.
    function readPanes(): { count: number; sig: string } {
      let i = 0
      let sig = ''
      for (const p of getPanes()) {
        if (i >= MAX_PANES) break
        const r = p.el.getBoundingClientRect()
        if (r.width < 2 || r.height < 2) continue
        paneRect[i * 4] = r.left
        paneRect[i * 4 + 1] = r.top
        paneRect[i * 4 + 2] = r.width
        paneRect[i * 4 + 3] = r.height
        paneRadius[i] = p.borderRadius
        sig += `${r.left.toFixed(1)},${r.top.toFixed(1)},${r.width.toFixed(1)},${r.height.toFixed(1)};`
        i++
      }

      const mp = getMaskPane()
      if (mp) {
        const r = mp.el.getBoundingClientRect()
        maskRect[0] = r.left - mp.overscan
        maskRect[1] = r.top - mp.overscan
        maskRect[2] = r.width + mp.overscan * 2
        maskRect[3] = r.height + mp.overscan * 2
        maskScale = mp.scale
        maskEnabled = 1
        sig += `M${maskRect[0].toFixed(1)},${maskRect[1].toFixed(1)};`
        if (maskUploaded !== mp.map) {
          gl.bindTexture(gl.TEXTURE_2D, maskTex)
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, mp.map)
          maskUploaded = mp.map
        }
      } else {
        maskEnabled = 0
      }

      return { count: i, sig }
    }

    function renderComposite(count: number) {
      const [vw, vh, dpr] = cssSize()
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
      gl.uniform1f(compU('uBezel'), BEZEL_WIDTH)
      gl.uniform1f(compU('uThick'), THICKNESS)
      gl.uniform1f(compU('uN2'), REFRACTIVE_INDEX)
      gl.uniform1f(compU('uMaxDisp'), maxDisp)
      gl.uniform1f(compU('uBlurPx'), BACKDROP_BLUR_PX)
      gl.uniform1f(compU('uSaturation'), BACKDROP_SATURATION)
      gl.uniform2f(compU('uLight'), LIGHT_X, LIGHT_Y)
      gl.uniform1f(compU('uSpecOpacity'), SPECULAR_OPACITY)
      gl.uniform1f(compU('uCounterLight'), COUNTER_LIGHT)
      gl.uniform1f(compU('uSpecExponent'), SPECULAR_EXPONENT)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, maskTex)
      gl.uniform1i(compU('uMask'), 1)
      gl.uniform4fv(compU('uMaskRect'), maskRect)
      gl.uniform1f(compU('uMaskScale'), maskScale)
      gl.uniform1i(compU('uMaskEnabled'), maskEnabled)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    function tick() {
      if (dead) return
      raf = requestAnimationFrame(tick)
      frame++

      if (resizeIfNeeded()) bgDirty = true
      if (bgDirty) {
        renderBg()
        bgDirty = false
        sceneDirty = true
      }

      // While recently active poll rects every frame; when idle, every 6th —
      // catches CSS transitions/animations we get no events for.
      const active = performance.now() - lastActivity < 300
      if (sceneDirty || active || frame % 6 === 0) {
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

    const unsubPanes = onPanesChanged(markActive)
    const onScroll = () => markActive()
    const onResize = () => markActive()
    const onLost = (e: Event) => {
      e.preventDefault()
      onFallback()
    }
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    window.addEventListener('resize', onResize)
    canvas.addEventListener('webglcontextlost', onLost)

    raf = requestAnimationFrame(tick)

    return () => {
      dead = true
      cancelAnimationFrame(raf)
      unsubPanes()
      window.removeEventListener('scroll', onScroll, { capture: true })
      window.removeEventListener('resize', onResize)
      canvas.removeEventListener('webglcontextlost', onLost)
      gl.deleteTexture(bgTex)
      gl.deleteTexture(maskTex)
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
      className="absolute inset-0 z-0 h-full w-full"
      aria-hidden
    />
  )
}
