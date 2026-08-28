import { Capacitor } from '@capacitor/core'

// Where /api/* lives.
//
// The APK bundles the web assets (see capacitor.config.ts) so the vocab list,
// flashcards and quiz all work with no connection. That same bundling means a
// relative '/api/…' resolves to https://localhost, which Capacitor serves from
// those bundled assets — there is no function there, so every API call failed
// silently in the packaged app.
//
// Only the calls that genuinely need a server get an absolute URL, and only
// when running natively. The browser build stays relative and same-origin, so
// dev and preview are unaffected.
//
// The API routes must allow this origin — see api/_cors.js.
const API_BASE = 'https://polish-vocab-app-git-main-thomasjaglin-4584s-projects.vercel.app'

export function apiUrl(path: string): string {
  return Capacitor.isNativePlatform() ? API_BASE + path : path
}
