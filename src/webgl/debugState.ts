// Temporary diagnostic channel for the flat-modal-on-mobile investigation.
// GlassCanvas writes its actual last-frame render state here; DebugHud reads
// it. Safe to delete once the root cause is confirmed.
export const glassDebug = {
  frame: 0,
  lastRenderFrame: 0,
  lastPaneCount: 0,
  lastMaskCount: 0,
  lastSig: 0,
  lastError: '',
  lastErrorFrame: 0,
  drawCalls: 0,
  // Actual numeric values written into paneRect/paneRadius right before
  // being uploaded to the shader, for the smallest few panes — to compare
  // directly against the independently-computed outline reading.
  lastPaneSample: [] as { x: number; y: number; w: number; h: number; r: number }[],
  uniforms: {
    uBezel: 0, uThick: 0, uN2: 0, uMaxDisp: 0, uBlurPx: 0, uSaturation: 0,
    uSpecOpacity: 0, uCounterLight: 0, uSpecExponent: 0,
  },
  // gl.readPixels() at the center of the smallest real pane — the actual
  // GPU-written RGBA byte value, bypassing any DOM/compositing ambiguity
  // entirely. Ground truth for what the shader really produced.
  readPixel: [0, 0, 0, 0] as [number, number, number, number],
  readPixelAt: '',
}
