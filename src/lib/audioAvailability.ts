// Whether a card's audio needs preparing at all.
//
// Two different worlds sit behind the `audioReady` flag:
//
//   browser  clips are fetched from api/tts and cached in IndexedDB, so a card
//            genuinely is or isn't ready, and preparing them in advance is real
//            work that respects a rate limit.
//   native   the device TTS engine speaks the card's text on demand. Nothing is
//            fetched, nothing is cached, and every card — enriched or not — is
//            playable the moment it exists.
//
// So on Android `audioReady` records only whether a user happened to run a batch
// job that does nothing, and gating anything on it is wrong: it hid 126 of 335
// perfectly playable cards from the audio review page. Ask this module instead
// of reading the flag directly.

import { Capacitor } from '@capacitor/core'

/** True where audio has to be fetched and cached ahead of time (browser only). */
export const AUDIO_NEEDS_PREPARING = !Capacitor.isNativePlatform()

/** Can this card be played right now? Natively: always. */
export function isAudioAvailable(audioReady?: boolean): boolean {
  return AUDIO_NEEDS_PREPARING ? !!audioReady : true
}
