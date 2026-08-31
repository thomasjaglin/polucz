import { describe, it, expect } from 'vitest'
import { isMissingVoiceError, polishVoiceStatus, MISSING_VOICE_MESSAGE } from './ttsVoice'

describe('isMissingVoiceError', () => {
  // The exact string the Android plugin rejects with — matched verbatim,
  // because everything else the engine can throw is a real fault and must not
  // be reported to the user as a missing voice.
  it('recognises the engine refusing the language', () => {
    expect(isMissingVoiceError(new Error('This language is not supported.'))).toBe(true)
  })

  it('recognises it when the message is wrapped or re-cased', () => {
    expect(isMissingVoiceError(new Error('speak failed: language is not supported'))).toBe(true)
    expect(isMissingVoiceError('This language is not supported.')).toBe(true)
  })

  it('does not claim a missing voice for other failures', () => {
    expect(isMissingVoiceError(new Error('Failed to read text.'))).toBe(false)
    expect(isMissingVoiceError(new Error('Network request failed'))).toBe(false)
    expect(isMissingVoiceError(undefined)).toBe(false)
    expect(isMissingVoiceError(null)).toBe(false)
  })
})

describe('polishVoiceStatus', () => {
  // Off-device the browser build synthesises through api/tts, so the device
  // engine has no say and the warning must never appear.
  it('reports ok on the web build', async () => {
    await expect(polishVoiceStatus()).resolves.toBe('ok')
  })
})

describe('the message', () => {
  it('names the problem without blaming the app', () => {
    expect(MISSING_VOICE_MESSAGE).toMatch(/Polish/)
    expect(MISSING_VOICE_MESSAGE).not.toMatch(/error|failed/i)
  })
})
