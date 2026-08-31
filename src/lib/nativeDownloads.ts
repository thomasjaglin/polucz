// Bridge to the app's own DownloadsPlugin (android/app/src/main/java/com/polucz/app).
//
// @capacitor/filesystem cannot write to the public Downloads folder: its
// Directory.Documents resolves to a public path that scoped storage blocks from
// Android 10 on, and it supports neither MediaStore nor SAF. So exporting a file
// the user can actually find needs this thin native plugin.

import { registerPlugin, Capacitor } from '@capacitor/core'

export interface SaveTextResult {
  /** content:// (API 29+) or file:// (legacy) URI of what was created. */
  uri: string
  /** Human-readable location for a toast, e.g. "Downloads/polucz-backup-….json". */
  path: string
}

interface DownloadsPlugin {
  saveText(options: { filename: string; data: string; mimeType?: string }): Promise<SaveTextResult>
}

const Downloads = registerPlugin<DownloadsPlugin>('Downloads')

/**
 * Writes text into the device's Downloads folder. Resolves with where it landed,
 * or null when that isn't possible (web, or API < 29 without the legacy
 * permission) so the caller can fall back to the share sheet.
 */
export async function saveToDownloads(
  filename: string,
  data: string,
  mimeType = 'application/json',
): Promise<SaveTextResult | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    return await Downloads.saveText({ filename, data, mimeType })
  } catch (e) {
    console.warn('Downloads.saveText failed, falling back to share', e)
    return null
  }
}
