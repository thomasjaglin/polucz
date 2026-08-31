#!/usr/bin/env node
/**
 * Captures the landing-page assets in assets/landing/ straight from the running app,
 * so the marketing images can never drift from what ships.
 *
 * Two kinds of output:
 *   - transparent cut-outs of single elements (card, nav, panes), alpha everywhere
 *     around them, drop shadow kept
 *   - whole screens with the gradient intact, for phone mockups
 *
 * It seeds the bundled starter deck, never the real vocabulary: no personal data
 * belongs in a marketing image.
 *
 * The glass surfaces sample whatever is behind them, so on a transparent canvas they
 * would come out nearly invisible. FILL below gives them a stand-in frosted fill —
 * see assets/landing/README.md for what that costs.
 *
 * Setup:
 *   npm run build && npx vite preview --port 4173
 *   "Google Chrome" --headless=new --remote-debugging-port=9222 --user-data-dir=/tmp/cp
 *   npm i -D chrome-remote-interface && node scripts/capture-landing-assets.mjs
 */
import CDP from 'chrome-remote-interface'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

const OUT = 'assets/landing'
mkdirSync(OUT, { recursive: true })
const deck = readFileSync('src/data/starterDeck.json', 'utf8')
const PAD = 44

const FILL = {
  light: `.kube-glass-bg, .glass-raise { background-color: rgba(255,255,255,0.80) !important; }
          .kube-glass-bg::before { background: rgba(255,255,255,0.30) !important; }`,
  dark:  `.kube-glass-bg, .glass-raise { background-color: rgba(32,32,38,0.82) !important; }
          .kube-glass-bg::before { background: rgba(255,255,255,0.05) !important; }`,
}
const HIDE_BG = `.app-bg-layer { display:none !important } canvas { display:none !important }
                 html, body, #root { background: transparent !important }`

// Helpers injected into the page: finding by rendered text is stable, whereas
// Tailwind's bracket classes (rounded-[36px]) are not valid in a CSS selector.
const HELPERS = `
  window.__byText = (needle, maxH) => [...document.querySelectorAll('body *')]
    .filter(el => (el.innerText || '').includes(needle))
    .filter(el => { const b = el.getBoundingClientRect(); return b.width > 80 && b.height > 30 && (!maxH || b.height < maxH) })
    [0]
  window.__outer = (el, cls) => { for (let n = el; n; n = n.parentElement) if ((n.className||'').toString().includes(cls)) return n; return el }
`

async function session(theme, fn) {
  const client = await CDP({ port: 9222 })
  const { Page, Runtime, Emulation } = client
  await Page.enable(); await Runtime.enable()
  await Emulation.setDeviceMetricsOverride({ width: 430, height: 932, deviceScaleFactor: 3, mobile: true })
  await Page.navigate({ url: 'http://localhost:4173/' }); await Page.loadEventFired()
  await Runtime.evaluate({ expression: `localStorage.setItem('polucz_vocab', ${JSON.stringify(deck)}); localStorage.setItem('polucz_theme','${theme}')` })
  await Page.reload(); await Page.loadEventFired()
  await new Promise(r => setTimeout(r, 2600))
  await Runtime.evaluate({ expression: HELPERS })

  const style = async (on) => {
    await Runtime.evaluate({ expression: on
      ? `(() => { if (document.getElementById('cap')) return; const s=document.createElement('style'); s.id='cap'; s.textContent=${JSON.stringify(HIDE_BG)}+${JSON.stringify(FILL[theme])}; document.head.appendChild(s) })()`
      : `document.getElementById('cap')?.remove()` })
    await new Promise(r => setTimeout(r, 500))
  }

  const js = async (expression) => {
    const r = await Runtime.evaluate({ expression, returnByValue: true, awaitPromise: true })
    return r.exceptionDetails ? { err: r.exceptionDetails.exception?.description } : r.result.value
  }

  /** finder: a JS expression evaluating to the element to capture. */
  const shot = async (name, finder) => {
    await style(true)
    await Emulation.setDefaultBackgroundColorOverride({ color: { r: 0, g: 0, b: 0, a: 0 } })
    const box = await js(`
      (() => {
        const el = (${finder})
        if (!el) return null
        const keep = new Set()
        for (let n = el; n; n = n.parentElement) keep.add(n)
        el.querySelectorAll('*').forEach(n => keep.add(n))
        window.__restore = []
        document.querySelectorAll('body *').forEach(n => {
          if (keep.has(n)) return
          window.__restore.push([n, n.style.visibility]); n.style.visibility = 'hidden'
        })
        const b = el.getBoundingClientRect()
        return JSON.stringify({ x: b.x, y: b.y, w: b.width, h: b.height })
      })()`)
    if (!box || box.err) { console.log('  MISS', name, box?.err ?? ''); return }
    const b = JSON.parse(box)
    const clip = { x: Math.max(0, b.x - PAD), y: Math.max(0, b.y - PAD), width: b.w + PAD * 2, height: b.h + PAD * 2, scale: 3 }
    const { data } = await Page.captureScreenshot({ format: 'png', clip, captureBeyondViewport: true, fromSurface: true })
    writeFileSync(`${OUT}/${name}-${theme}.png`, Buffer.from(data, 'base64'))
    console.log('  ✓', `${name}-${theme}.png`, `${Math.round(b.w)}×${Math.round(b.h)}pt`)
    await js(`(window.__restore||[]).forEach(([n,v]) => n.style.visibility = v); window.__restore = []`)
  }

  const full = async (name) => {
    await style(false)
    await Emulation.setDefaultBackgroundColorOverride({ color: { r: 0, g: 0, b: 0, a: 255 } })
    await new Promise(r => setTimeout(r, 700))
    const { data } = await Page.captureScreenshot({ format: 'png', fromSurface: true })
    writeFileSync(`${OUT}/${name}-${theme}.png`, Buffer.from(data, 'base64'))
    console.log('  ✓', `${name}-${theme}.png`, 'full screen')
  }

  const nav = async (icon) => {
    await style(false)
    await js(`[...document.querySelectorAll('span.material-symbols-rounded')].find(s => s.textContent.trim() === '${icon}')?.closest('button')?.click()`)
    await new Promise(r => setTimeout(r, 1800))
  }

  await fn({ shot, full, nav, js, style })
  await client.close()
}

for (const theme of ['light', 'dark']) {
  console.log('\n' + theme)
  await session(theme, async ({ shot, full, nav, js }) => {
    await full('screen-list')
    await shot('card', `document.querySelector('.card-cv')`)
    await shot('filter-pane', `window.__byText('26 words', 260)`)
    await shot('bottom-nav', `document.querySelector('[class*="fixed bottom-"]')`)

    // Word detail — the click handler sits on the inner .perspective element.
    await js(`document.querySelector('.perspective')?.click()`)
    await new Promise(r => setTimeout(r, 2000))
    const opened = await js(`/mianownik|dopełniacz|Examples|Forms/i.test(document.body.innerText)`)
    console.log('  detail modal open:', opened)
    if (opened) { await full('screen-detail'); await shot('word-detail', `window.__byText('difficult', 900)`) }
    await js(`[...document.querySelectorAll('button')].find(b => /close/.test(b.innerText))?.click()`)
    await new Promise(r => setTimeout(r, 1200))

    await nav('dynamic_feed'); await full('screen-flashcards')
    await nav('question_mark'); await full('screen-quiz')
    await shot('quiz-modes', `window.__byText('Declension Quiz', 200)`)
    await nav('spatial_audio'); await full('screen-audio')
  })
}
