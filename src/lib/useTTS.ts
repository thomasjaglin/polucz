import { useState, useRef, useCallback, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { TextToSpeech } from '@capacitor-community/text-to-speech'
import { getCachedClip, putCachedClip } from './audioCache'
import { getPlaybackRate, subscribeRate } from './playbackRate'

// On Android the device's own speech engine does the talking. It needs no key,
// no network and no preparation, and it works whichever LLM the user picked —
// Claude has no audio API at all, so tying pronunciation to the chosen provider
// would have left some users with no speech.
//
// Clips generated earlier by Gemini are still preferred when they're already in
// the cache: they sound better, and there's no reason to discard work already
// done. Only the browser build still reaches for api/tts.
const USE_NATIVE_TTS = Capacitor.isNativePlatform()

const LANG_TAG = { pl: 'pl-PL', en: 'en-US' } as const

function speakNative(text: string, language: 'pl' | 'en'): Promise<void> {
  return TextToSpeech.speak({
    text,
    lang: LANG_TAG[language],
    rate: getPlaybackRate(),
  })
}

export type AudioState = 'idle' | 'loading' | 'playing' | 'error'

// Fetch a clip with retry + backoff. IMPORTANT: on a 429 (the TTS provider's
// rate limit) we do NOT retry — hammering it just burns more quota and makes the
// limit worse. We only retry transient 5xx/network errors. Requests are meant to
// be low-volume (audio is cached per-card via the modal), so this stays well
// under the provider's per-minute ceiling.
async function fetchBlob(text: string, language: 'pl' | 'en', retries = 2): Promise<Blob> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 700 * Math.pow(2, attempt - 1)))
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language }),
      })
      if (res.status === 429) throw Object.assign(new Error('TTS rate limited'), { rateLimited: true })
      if (!res.ok) throw new Error(`TTS fetch failed (${res.status})`)
      const { audio, mimeType } = await res.json()
      if (!audio) throw new Error('No audio in response')
      const bytes = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0))
      return new Blob([bytes], { type: mimeType ?? 'audio/wav' })
    } catch (e) {
      lastErr = e
      if ((e as { rateLimited?: boolean }).rateLimited) break // don't retry a rate limit
    }
  }
  throw lastErr
}


export function useTTS() {
  const [state, setState] = useState<AudioState>('idle')
  const abortRef   = useRef(false)
  // ONE reused <audio> element for the whole hook. The browser's autoplay policy
  // blocks play() on a *fresh* element started outside a user gesture, so the
  // old "new Audio() per clip" made every auto-advanced word silent (only the
  // gesture-started first word played). A single element, once unlocked by the
  // first gesture-driven play, keeps playing subsequent clips/words from timers.
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const curUrlRef  = useRef<string | null>(null)   // object URL of the loaded clip, to revoke
  // cancelRef holds a fn that resolves the in-flight playOne promise so stop() can unblock the sequence loop
  const cancelRef  = useRef<(() => void) | null>(null)
  // Blobs are immutable and safe to cache; only the ObjectURL created from them needs revoking
  const cache      = useRef<Map<string, Blob>>(new Map())

  // Auto-reset error state after 2 s so the icon returns to idle without a tap
  useEffect(() => {
    if (state !== 'error') return
    const t = setTimeout(() => setState('idle'), 2000)
    return () => clearTimeout(t)
  }, [state])

  // Stop and clean up when the component that owns this hook unmounts
  useEffect(() => {
    return () => {
      abortRef.current = true
      audioElRef.current?.pause()
      cancelRef.current?.()
      if (curUrlRef.current) URL.revokeObjectURL(curUrlRef.current)
    }
  }, [])

  // Apply speed changes to the clip that's already playing, not just the next.
  useEffect(() => subscribeRate(() => {
    if (audioElRef.current) audioElRef.current.playbackRate = getPlaybackRate()
  }), [])

  // Three-tier lookup: in-memory (this session) → IndexedDB (persisted across
  // sessions) → network (generate once, then persist). So a word is fetched
  // from the TTS API at most once, ever.
  const getBlob = useCallback(async (text: string, language: 'pl' | 'en'): Promise<Blob> => {
    const key = `${language}:${text}`
    const mem = cache.current.get(key)
    if (mem) return mem

    const persisted = await getCachedClip(key)
    if (persisted) {
      cache.current.set(key, persisted)
      return persisted
    }

    const blob = await fetchBlob(text, language)
    cache.current.set(key, blob)
    // Await the persist so a card is only ever marked "audio-ready" once its
    // clips are durably in IndexedDB (prevents the flag/cache drift that made
    // playback still hit the API and skip).
    await putCachedClip(key, blob)
    return blob
  }, [])

  // Memory → IndexedDB, no network. Used by the native path to prefer a clip
  // that already exists over synthesising a new one.
  const getCachedBlob = useCallback(async (text: string, language: 'pl' | 'en'): Promise<Blob | null> => {
    const key = `${language}:${text}`
    const mem = cache.current.get(key)
    if (mem) return mem
    const persisted = await getCachedClip(key)
    if (persisted) cache.current.set(key, persisted)
    return persisted ?? null
  }, [])

  const playOne = useCallback((blob: Blob): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Lazily create the single reused element on first use.
      let audio = audioElRef.current
      if (!audio) {
        audio = new Audio()
        // Time-stretch, not pitch-shift, so slower/faster keeps a natural voice.
        // (preservesPitch is the standard prop; webkit* covers older WebViews.)
        const a = audio as HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean }
        a.preservesPitch = true
        a.webkitPreservesPitch = true
        audioElRef.current = audio
      }
      const el = audio

      // Point the reused element at this clip; revoke the previous clip's URL.
      if (curUrlRef.current) URL.revokeObjectURL(curUrlRef.current)
      const url = URL.createObjectURL(blob)
      curUrlRef.current = url
      el.src = url
      el.playbackRate = getPlaybackRate()

      const done = (ok: boolean) => {
        cancelRef.current = null
        el.onended = null   // don't let this clip's handlers fire for the next one
        el.onerror = null
        if (ok) resolve()
        else reject(new Error('Playback failed'))
      }

      // Expose a resolve path so stop() can unblock this promise immediately
      cancelRef.current = () => { el.pause(); done(true) }
      el.onended = () => done(true)
      el.onerror = () => done(false)
      el.play().catch(() => done(false))
    })
  }, [])

  const stop = useCallback(() => {
    abortRef.current = true
    audioElRef.current?.pause()
    if (USE_NATIVE_TTS) TextToSpeech.stop().catch(() => {})
    cancelRef.current?.()   // resolves the pending playOne; the sequence loop then hits abortRef and exits
    setState('idle')
  }, [])

  // Silent pre-fetch for both clips — populates the cache. Returns true only if
  // both clips are now cached (used to mark a card "audio-ready").
  const prefetch = useCallback(async (pl: string, en: string): Promise<boolean> => {
    // Nothing to prepare natively — the device engine is always available, so a
    // card is audio-ready the moment it exists.
    if (USE_NATIVE_TTS) return true
    try {
      await Promise.all([getBlob(pl, 'pl'), getBlob(en, 'en')])
      return true
    } catch {
      return false
    }
  }, [getBlob])

  const playSequence = useCallback(async (pl: string, en: string) => {
    stop()
    abortRef.current = false
    setState('loading')
    try {
      // Resolve each utterance to a cached clip where one exists. Natively that
      // is the only lookup — nothing is fetched — so playback starts at once;
      // in the browser this is the existing fetch-and-persist path.
      const resolve = USE_NATIVE_TTS ? getCachedBlob : getBlob
      const [plBlob, enBlob] = await Promise.all([resolve(pl, 'pl'), resolve(en, 'en')])
      if (abortRef.current) return
      setState('playing')

      // PL → 1 s → EN → 1 s → PL → 1 s → EN
      // The gap uses cancelRef so stop() can unblock it immediately (same as playOne)
      const clips: [Blob | null, string, 'pl' | 'en'][] = [
        [plBlob, pl, 'pl'], [enBlob, en, 'en'], [plBlob, pl, 'pl'], [enBlob, en, 'en'],
      ]
      for (let i = 0; i < clips.length; i++) {
        if (abortRef.current) return
        const [blob, text, lang] = clips[i]
        if (blob) await playOne(blob)
        else await speakNative(text, lang)
        if (i < clips.length - 1 && !abortRef.current) {
          await new Promise<void>(resolve => {
            const t = setTimeout(resolve, 1000)
            cancelRef.current = () => { clearTimeout(t); resolve() }
          })
          cancelRef.current = null
        }
        if (abortRef.current) return
      }

      if (!abortRef.current) setState('idle')
    } catch {
      if (!abortRef.current) setState('error')
    }
  }, [stop, getBlob, getCachedBlob, playOne])

  return { state, stop, prefetch, playSequence }
}
