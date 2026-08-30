// The app was renamed Polucz → Polon, and its localStorage keys with it. Anyone
// already running a build from before the rename has their vocabulary, review
// history and settings under the old prefix; without this they would open the
// app to an empty list.
//
// On Android the rename also changed the applicationId, so the new package
// starts with empty storage and there is nothing here to find — this exists for
// the browser build and for any side-loaded APK carried across the rename.
//
// Idempotent: a key is only copied when the new name is absent, so re-running
// never clobbers newer data with a stale copy. Runs before React mounts.

const OLD = /^polucz([_-])/

export function migrateStorageKeys(): void {
  let moved = 0
  try {
    for (const oldKey of Object.keys(localStorage)) {
      if (!OLD.test(oldKey)) continue
      const newKey = oldKey.replace(OLD, 'polon$1')
      const value = localStorage.getItem(oldKey)
      if (value === null) continue
      // Only fill a gap. If the new key already holds something, that value is
      // by definition more recent than a pre-rename leftover.
      if (localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, value)
        moved++
      }
      // Copy first, remove second: an interruption leaves the old key intact
      // and the next run picks up where this one stopped.
      localStorage.removeItem(oldKey)
    }
  } catch {
    // A full or unavailable quota must not stop the app booting. The old keys
    // are left untouched, so a later run can still complete the move.
    return
  }
  if (moved) console.info(`Migrated ${moved} storage keys from the Polucz naming`)
}
