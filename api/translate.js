export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { text } = req.body ?? {}
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'text is required' })

  const apiKey = process.env.DEEPL_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Translation service not configured' })

  const base = apiKey.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com'

  try {
    const r = await fetch(`${base}/v2/translate`, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: [text], source_lang: 'PL', target_lang: 'EN-US' }),
    })
    if (!r.ok) return res.status(502).json({ error: 'Translation service error' })
    const data = await r.json()
    return res.status(200).json({ translation: data.translations?.[0]?.text ?? '' })
  } catch {
    return res.status(500).json({ error: 'Internal server error' })
  }
}
