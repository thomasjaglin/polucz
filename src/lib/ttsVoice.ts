// Whether this device can actually say Polish.
//
// Pronunciation uses Android's own speech engine, which means it depends on
// something the app does not ship: the Polish language pack. Without it the
// plugin rejects speak() with "This language is not supported.", the hook
// flashed an error icon for two seconds, and nothing anywhere said why — the
// app was simply mute.
//
// Note what `supported` means underneath: the plugin maps Android's
// isLanguageAvailable() to true only for LANG_AVAILABLE and friends, so both
// LANG_MISSING_DATA (the pack was never downloaded) and LANG_NOT_SUPPORTED
// (this engine has no Polish at all) arrive here as false. The first is fixable
// by the user and the second is not, and Android does not let us tell them
// apart — so the copy offers the install screen without promising it will help.

import { registerPlugin, Capacitor } from '@capacitor/core'
import { TextToSpeech } from '@capacitor-community/text-to-speech'

const POLISH = 'pl-PL'

/** The exact message the TTS plugin rejects with. */
const UNSUPPORTED = 'This language is not supported.'

interface VoicePlugin {
  openVoiceSettings(): Promise<{ opened: 'install' | 'settings' | 'none' }>
}
const Voice = registerPlugin<VoicePlugin>('Voice')

export type VoiceStatus =
  /** Polish can be spoken, or this is the browser build, which uses api/tts. */
  | 'ok'
  /** The engine will not speak Polish. Offer the install screen. */
  | 'missing'
  /** The engine could not be asked. Say nothing rather than guess. */
  | 'unknown'

let cached: VoiceStatus | null = null

/** True when a rejection is the engine refusing the language, not a real fault. */
export function isMissingVoiceError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? '')
  return msg.includes(UNSUPPORTED) || /language is not supported/i.test(msg)
}

/**
 * Asks the engine once per session, since the answer only changes when the user
 * leaves the app to install a voice — see forgetVoiceStatus().
 */
export async function polishVoiceStatus(): Promise<VoiceStatus> {
  // The browser build synthesises through api/tts, so the device engine's
  // opinion is irrelevant there.
  if (!Capacitor.isNativePlatform()) return 'ok'
  if (cached) return cached
  try {
    const { supported } = await TextToSpeech.isLanguageSupported({ lang: POLISH })
    cached = supported ? 'ok' : 'missing'
  } catch {
    cached = 'unknown'
  }
  return cached
}

/** Drops the cached answer, so the next check re-asks the engine. */
export function forgetVoiceStatus(): void {
  cached = null
}

/** Records what speak() just told us, so a settings screen agrees with reality. */
export function noteMissingVoice(): void {
  cached = 'missing'
}

/**
 * Opens wherever this device lets a user add the voice.
 *
 * Resolves with what actually opened: 'none' means neither screen exists here,
 * and the caller has to tell the user rather than leaving a dead button.
 */
export async function openVoiceSettings(): Promise<'install' | 'settings' | 'none'> {
  if (!Capacitor.isNativePlatform()) return 'none'
  try {
    const { opened } = await Voice.openVoiceSettings()
    // They may fix it while they are over there.
    forgetVoiceStatus()
    return opened
  } catch {
    return 'none'
  }
}

/** What to tell the user when Polish cannot be spoken. */
export const MISSING_VOICE_MESSAGE =
  'This device has no Polish speech voice installed'
