import { LIGHT_X, LIGHT_Y } from '../lib/glassParams'

// Live-tunable shader effect parameters for the WebGL glass experiments.
// The glass lab (?lab in webgl mode) exposes sliders for these; GlassCanvas
// reads them every composite pass and re-renders continuously while any
// animated effect (wobble, auto/tilt light) is active.
export interface ShaderFx {
  chroma: number     // 0..1 — chromatic aberration strength at refracting edges
  fresnel: number    // 0..1 — edge reflectivity mixing a fake environment
  wobble: number     // 0..1 — liquid normal perturbation (animated)
  lightAngle: number // radians — specular light direction
  autoLight: boolean // slowly drift the light for a living highlight
  tiltLight: boolean // drive the light from device orientation (mobile)
  lead: number       // frames of rect extrapolation — compensates the canvas
                     // lagging behind compositor-driven DOM motion (scroll,
                     // drags); 0 disables prediction
}

export const fx: ShaderFx = {
  chroma: 0.35,
  fresnel: 0.3,
  wobble: 0,
  lightAngle: Math.atan2(LIGHT_Y, LIGHT_X),
  autoLight: false,
  tiltLight: false,
  lead: 1.2,
}

const listeners = new Set<() => void>()

export function setFx(patch: Partial<ShaderFx>) {
  Object.assign(fx, patch)
  listeners.forEach(l => l())
}

export function onFxChange(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function isAnimated(): boolean {
  return fx.wobble > 0.001 || fx.autoLight || fx.tiltLight
}
