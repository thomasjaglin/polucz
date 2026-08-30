// Android hardware-back handling for our routing-less SPA.
//
// The problem: we have no URL routing, so nothing on screen corresponds to a
// history entry. Left alone, a back press closes the whole app rather than the
// overlay or sub-screen the user is actually looking at.
//
// Capacitor 8's BridgeActivity has NO back handling of its own — no
// canGoBack()/goBack(), no onBackPressed override — and on targetSdk 36 the
// legacy onBackPressed path is gone anyway (predictive back routes through
// OnBackPressedDispatcher). So a back press went straight to the system
// default and finished the activity. @capacitor/app is what puts it back in
// our hands: its plugin registers an OnBackPressedCallback and, as soon as a
// `backButton` JS listener exists, forwards the press to us and exits only
// when we say so.
//
// The model: a LIFO stack of open "layers" (overlays, sub-screens, non-root
// pages). A back press closes the topmost. At the root the first press arms a
// 2-second "press back again to exit" window; a second press within it exits.
//
// The browser keeps the original history-based scheme, since there is no
// plugin event there: one baseline entry plus one per layer, with popstate
// standing in for the back press.

import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { pushToast } from './toastStore'

type Layer = { onClose: () => void }

const NATIVE = Capacitor.isNativePlatform()

const stack: Layer[] = []
let installed = false

// popstate fired by our own guarded history.back() (used to keep history
// balanced when a layer is closed by something other than the back button)
// must be ignored, not treated as a user back-press. Web only.
let ignorePops = 0

// Root "press back again to exit" grace window.
let exitArmed = false
let exitTimer: number | null = null

function armExit() {
  exitArmed = true
  pushToast('Press back again to exit', 'info')
  if (exitTimer) clearTimeout(exitTimer)
  exitTimer = window.setTimeout(() => {
    exitArmed = false
    exitTimer = null
    // Web only: we consumed the baseline when arming, so a later back would
    // otherwise navigate away. Natively nothing was consumed.
    if (!NATIVE) history.pushState(null, '', location.href)
  }, 2000)
}

function disarmExit() {
  if (!exitArmed) return
  exitArmed = false
  if (exitTimer) { clearTimeout(exitTimer); exitTimer = null }
  if (!NATIVE) history.pushState(null, '', location.href)
}

// One back press. Close the topmost layer, or handle the root case.
function handleBack() {
  if (stack.length > 0) {
    stack.pop()!.onClose()
    return
  }
  if (exitArmed) {
    exitArmed = false
    if (exitTimer) { clearTimeout(exitTimer); exitTimer = null }
    if (NATIVE) App.exitApp()
    return
  }
  armExit()
}

function onPopState() {
  if (ignorePops > 0) { ignorePops--; return }
  handleBack()
}

// Call once, on app mount.
export function initBackHandler() {
  if (installed) return
  installed = true

  if (NATIVE) {
    // Registering this listener is also what stops the plugin from falling
    // back to its own canGoBack()/goBack() (and thus to exiting) — it only
    // forwards the press once a listener exists.
    App.addListener('backButton', handleBack)
    return
  }

  history.pushState(null, '', location.href) // baseline
  window.addEventListener('popstate', onPopState)
}

// Register an open layer. `onClose` should be the same close path the UI uses
// (X button, outside-click, etc.). Returns an unregister to call when the layer
// closes by any means OTHER than the back button.
export function pushLayer(onClose: () => void): () => void {
  disarmExit() // opening a layer cancels a pending exit prompt
  const layer: Layer = { onClose }
  stack.push(layer)
  if (!NATIVE) history.pushState(null, '', location.href)

  let done = false
  return () => {
    if (done) return
    done = true
    const i = stack.indexOf(layer)
    if (i === -1) return // already popped by a back-press
    stack.splice(i, 1)
    // Web: consume the entry we pushed so history stays balanced (one entry per
    // open layer). Entries are interchangeable, so dropping the top one is
    // correct regardless of which layer closed. Natively there is no history to
    // keep in step — the stack IS the state.
    if (!NATIVE) {
      ignorePops++
      history.back()
    }
  }
}
