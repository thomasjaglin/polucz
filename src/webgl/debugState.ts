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
}
