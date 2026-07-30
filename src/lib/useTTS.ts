import { useState, useRef, useCallback, useEffect } from 'react'
import { getCachedClip, putCachedClip } from './audioCache'

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
  const currentRef = useRef<HTMLAudioElement | null>(null)
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
      currentRef.current?.pause()
      cancelRef.current?.()
    }
  }, [])

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
    putCachedClip(key, blob) // fire-and-forget persist
    return blob
  }, [])

  const playOne = useCallback((blob: Blob): Promise<void> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      currentRef.current = audio

      const done = (ok: boolean) => {
        cancelRef.current = null
        URL.revokeObjectURL(url)
        if (currentRef.current === audio) currentRef.current = null
        if (ok) resolve()
        else reject(new Error('Playback failed'))
      }

      // Expose a resolve path so stop() can unblock this promise immediately
      cancelRef.current = () => done(true)
      audio.onended = () => done(true)
      audio.onerror = () => done(false)
      audio.play().catch(() => done(false))
    })
  }, [])

  const stop = useCallback(() => {
    abortRef.current = true
    currentRef.current?.pause()
    cancelRef.current?.()   // resolves the pending playOne; the sequence loop then hits abortRef and exits
    setState('idle')
  }, [])

  // Silent pre-fetch for both clips — populates the cache. Returns true only if
  // both clips are now cached (used to mark a card "audio-ready").
  const prefetch = useCallback(async (pl: string, en: string): Promise<boolean> => {
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
      const [plBlob, enBlob] = await Promise.all([getBlob(pl, 'pl'), getBlob(en, 'en')])
      if (abortRef.current) return
      setState('playing')

      // PL → 1 s → EN → 1 s → PL → 1 s → EN
      // The gap uses cancelRef so stop() can unblock it immediately (same as playOne)
      const clips = [plBlob, enBlob, plBlob, enBlob]
      for (let i = 0; i < clips.length; i++) {
        if (abortRef.current) return
        await playOne(clips[i])
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
  }, [stop, getBlob, playOne])

  return { state, stop, prefetch, playSequence }
}
