// Android hardware-back handling for our routing-less SPA.
//
// The problem: Android's back button pops browser history, or — with no history
// to pop — closes the WebView. We have no URL routing, so without intervention
// the first back press quits the app instead of closing whatever overlay is on
// screen.
//
// The fix: keep one "baseline" history entry so a back press always has
// something to consume, and push an extra entry for every open overlay. A
// single popstate handler then closes the topmost overlay (LIFO) instead of
// letting the browser navigate. At the root (no overlay) the first back arms a
// 2-second "press back again to exit" window; a second back within it lets the
// native WebView exit (its history is now empty so Android finishes the
// activity). No overlay ever lets the back button reach an accidental exit.
//
// Packaging note: this works with Capacitor's *default* back behaviour (Android
// WebView canGoBack()/goBack(), which our pushState entries feed and which
// fires popstate). When @capacitor/app is added later, nothing here needs to
// change unless you want an explicit App.exitApp() — then register a
// `backButton` listener that calls this module's logic and swap the arm-branch
// for App.exitApp(). The overlay stack + hook stay identical.

import { pushToast } from './toastStore'

type Layer = { onClose: () => void }

const stack: Layer[] = []
let installed = false

// popstate fired by our own guarded history.back() (used to keep history
// balanced when an overlay is closed by something other than the back button)
// must be ignored, not treated as a user back-press.
let ignorePops = 0

// Root "press back again to exit" grace window.
let exitArmed = false
let exitTimer: number | null = null

function armExit() {
  exitArmed = true
  pushToast('Press back again to exit', 'info')
  if (exitTimer) clearTimeout(exitTimer)
  // If they don't press again, restore the baseline so a later back doesn't
  // silently exit — the window has closed and we're safe again.
  exitTimer = window.setTimeout(() => {
    exitArmed = false
    exitTimer = null
    history.pushState(null, '', location.href)
  }, 2000)
}

function disarmExit() {
  if (!exitArmed) return
  exitArmed = false
  if (exitTimer) { clearTimeout(exitTimer); exitTimer = null }
  // We consumed the baseline when arming; restore it now that we're staying.
  history.pushState(null, '', location.href)
}

function onPopState() {
  if (ignorePops > 0) { ignorePops--; return }

  if (stack.length > 0) {
    // Back-press consumed the top overlay's entry — close that overlay. The
    // baseline still sits underneath, so the app never accidentally exits.
    stack.pop()!.onClose()
    return
  }

  // Root: the baseline entry was just consumed (canGoBack is now false).
  if (exitArmed) return // let the next native back finish the activity
  armExit()
}

// Call once, on app mount.
export function initBackHandler() {
  if (installed) return
  installed = true
  history.pushState(null, '', location.href) // baseline
  window.addEventListener('popstate', onPopState)
}

// Register an open overlay. `onClose` should be the same close path the UI uses
// (X button, outside-click, etc.). Returns an unregister to call when the
// overlay closes by any means OTHER than the back button.
export function pushLayer(onClose: () => void): () => void {
  disarmExit() // opening an overlay cancels a pending exit prompt
  const layer: Layer = { onClose }
  stack.push(layer)
  history.pushState(null, '', location.href)

  let done = false
  return () => {
    if (done) return
    done = true
    const i = stack.indexOf(layer)
    if (i === -1) return // already popped by a back-press; its entry was consumed
    stack.splice(i, 1)
    // Programmatic close: consume the entry we pushed so history stays balanced
    // (one entry per open overlay). Entries are interchangeable, so dropping the
    // top one is correct regardless of which layer closed.
    ignorePops++
    history.back()
  }
}
