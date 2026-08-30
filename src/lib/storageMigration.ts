// The app briefly shipped as Polon before the name went back to Polucz, and its
// localStorage keys moved with it each time. Anyone whose data was written
// during that window holds it under the polon_ prefix; without this they would
// open the app to an empty list.
//
// The direction is polon_ → polucz_. It reads backwards next to the git
// history — the rename went the other way first — but the destination is
// whatever the app reads today, and that is polucz_.
//
// On Android the renames also moved the applicationId, so each package has its
// own storage and there is nothing here to find. This exists for the browser
// build and for any side-loaded APK carried across the rename.
//
// Idempotent: a key is only copied when the destination is absent, so re-running
// never clobbers newer data with a stale copy. Runs before React mounts.

const LEGACY = /^polon([_-])/

export function migrateStorageKeys(): void {
  let moved = 0
  try {
    for (const legacyKey of Object.keys(localStorage)) {
      if (!LEGACY.test(legacyKey)) continue
      const currentKey = legacyKey.replace(LEGACY, 'polucz$1')
      const value = localStorage.getItem(legacyKey)
      if (value === null) continue
      // Only fill a gap. If the current key already holds something, that value
      // is by definition more recent than a leftover from the rename window.
      if (localStorage.getItem(currentKey) === null) {
        localStorage.setItem(currentKey, value)
        moved++
      }
      // Copy first, remove second: an interruption leaves the legacy key intact
      // and the next run picks up where this one stopped.
      localStorage.removeItem(legacyKey)
    }
  } catch {
    // A full or unavailable quota must not stop the app booting. The legacy keys
    // are left untouched, so a later run can still complete the move.
    return
  }
  if (moved) console.info(`Migrated ${moved} storage keys from the Polon naming`)
}
