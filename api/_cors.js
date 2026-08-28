// Cross-origin access for the packaged app.
//
// The APK bundles the web assets and serves them from https://localhost, so its
// calls to these functions are cross-origin. Without these headers the WebView
// blocks every one of them before the request is even sent. The browser build
// is same-origin and never reaches this path.
//
// The client sends x-llm-* headers and a JSON content-type, none of which are
// CORS-"simple", so the WebView issues an OPTIONS preflight first — a handler
// that only answers POST would fail the preflight and the real request would
// never follow.

const ALLOWED_ORIGINS = new Set([
  'https://localhost',     // Capacitor Android
  'capacitor://localhost', // Capacitor iOS
  'http://localhost:5173', // vite dev server
])

/** Returns true when the request was a preflight and is now fully handled. */
export function applyCors(req, res) {
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    // Echoing one of several origins means the response varies by it; without
    // this a cache could serve one origin's response to another.
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader(
      'Access-Control-Allow-Headers',
      'content-type, x-llm-provider, x-llm-model, x-llm-key, x-llm-base-url, x-deepl-key',
    )
    res.setHeader('Access-Control-Max-Age', '86400')
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}
