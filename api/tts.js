const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent'

// Gemini TTS returns raw 16-bit signed PCM at 24 kHz mono.
// Browsers can't play l16 directly — we wrap it in a standard WAV container.
const SAMPLE_RATE = 24000
const CHANNELS = 1
const BITS = 16

function pcmToWav(pcmBuffer) {
  const byteRate = (SAMPLE_RATE * CHANNELS * BITS) / 8
  const blockAlign = (CHANNELS * BITS) / 8
  const dataSize = pcmBuffer.length
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataSize, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)            // PCM sub-chunk size
  header.writeUInt16LE(1, 20)             // PCM format (1 = uncompressed)
  header.writeUInt16LE(CHANNELS, 22)
  header.writeUInt32LE(SAMPLE_RATE, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(BITS, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)
  return Buffer.concat([header, pcmBuffer])
}

function buildPrompt(text, language) {
  return language === 'en'
    ? `Say this English word or phrase clearly: ${text}`
    : `Pronounce this Polish word or phrase clearly and at a natural, unhurried pace: ${text}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { text, language = 'pl' } = req.body ?? {}
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' })
  }
  if (text.trim().length > 300) {
    return res.status(400).json({ error: 'text too long' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'TTS service not configured' })

  let r
  try {
    r = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(text.trim(), language) }] }],
        generationConfig: {
          response_modalities: ['AUDIO'],
          speech_config: {
            voice_config: {
              prebuilt_voice_config: { voice_name: 'Kore' },
            },
          },
        },
      }),
    })
  } catch {
    return res.status(500).json({ error: 'Internal server error' })
  }

  if (!r.ok) {
    const errBody = await r.text().catch(() => '')
    console.error('Gemini TTS error', r.status, errBody)
    return res.status(502).json({ error: 'TTS service error' })
  }

  const data = await r.json()
  const inlineData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData
  if (!inlineData?.data) {
    console.error('No audio data in TTS response', JSON.stringify(data).slice(0, 200))
    return res.status(502).json({ error: 'No audio in response' })
  }

  const wav = pcmToWav(Buffer.from(inlineData.data, 'base64'))
  return res.status(200).json({ audio: wav.toString('base64'), mimeType: 'audio/wav' })
}
