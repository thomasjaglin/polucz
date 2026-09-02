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
 * It seeds assets/landing/demo-deck.json, never the real vocabulary: no personal
 * data belongs in a marketing image. That fixture is not the shipped starter deck
 * either — the app now welcomes you with just dzień and dobry, and a two-card list
 * makes a poor screenshot. Ten words, one of every card shape, one of them mastered
 * so the foil appears.
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
const deck = readFileSync('assets/landing/demo-deck.json', 'utf8')

// The sentence the landing page's walkthrough is built around, and the answers
// the app would get back for it. The network is stubbed rather than called: this
// is a marketing capture, and a real DeepL key has no business in a build step.
// Everything else is the app's own code path — its real UI, its real state, its
// real rendering. Only the wire is faked.
const SENTENCE = 'Chleb zabija ptaki'

// The walkthrough is a before and an after, so the two moments need different
// vocabularies. On the translate page the sign's words have not been kept yet —
// seeded with them present they render "✓ In vocabulary" and the panel that says
// "keep the two you could not have looked up" shows nothing to keep. The list and
// flashcard panels use the full deck, where they are.
const MINED = ['ptak', 'zabijać']
const deckBeforeMining = JSON.stringify(
  JSON.parse(deck).filter(c => !MINED.includes(c.pl)))
const STUB = {
  '/api/translate': { translation: 'Bread kills birds' },
  '/api/analyze-sentence': {
    words: [
      { lemma: 'chleb',   type: 'noun', english: 'bread',   gender: 'm' },
      { lemma: 'zabijać', type: 'verb', english: 'to kill', gender: '' },
      { lemma: 'ptak',    type: 'noun', english: 'bird',    gender: 'm' },
    ],
  },
}
// A card is mastered when its review state says so, and the foil is one of the
// most distinctive things the app draws — without this the shots omit it.
// The list renders newest-first, i.e. the reverse of the fixture's order, so the
// mastered word has to sit near the END of demo-deck.json to appear near the top.
// Every walkthrough marked finished, or each page offers its tour card over
// the shot. The store keys an id to a RECORD; a bare status string is ignored.
const tours = JSON.stringify(Object.fromEntries(
  ['arrival', 'flashcards', 'quiz', 'audio'].map(id => [id, { status: 'done' }])))
const reviews = JSON.stringify({
  'piękny': {
    interval: 180, easeFactor: 2.5, reviewCount: 14, conquered: true,
    conquerProgress: 3, lastReviewed: '2026-09-01',
    dueDate: '2027-03-01',
  },
})
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
  const client = await CDP({ host: '127.0.0.1', port: 9222 })
  const { Page, Runtime, Emulation } = client
  await Page.enable(); await Runtime.enable()
  await Emulation.setDeviceMetricsOverride({ width: 430, height: 932, deviceScaleFactor: 3, mobile: true })
  await Page.navigate({ url: 'http://127.0.0.1:4173/' }); await Page.loadEventFired()
  await Runtime.evaluate({ expression: `localStorage.setItem('polucz_vocab', ${JSON.stringify(deck)}); localStorage.setItem('polucz_reviews', ${JSON.stringify(reviews)}); localStorage.setItem('polucz_theme','${theme}'); localStorage.setItem('polucz_tours', ${JSON.stringify(tours)})` })
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

// ─── Translate flow ──────────────────────────────────────────────────────────
// Its own session: the stub has to be in place before anything is clicked, and
// the page needs a DeepL key present or the button stays disabled.
async function translateSession(theme, seedDeck, suffix) {
  const client = await CDP({ host: '127.0.0.1', port: 9222 })
  const { Page, Runtime, Emulation } = client
  await Page.enable(); await Runtime.enable()
  await Emulation.setDeviceMetricsOverride({ width: 430, height: 932, deviceScaleFactor: 3, mobile: true })
  await Page.navigate({ url: 'http://127.0.0.1:4173/' }); await Page.loadEventFired()

  const js = async (expression) => {
    const r = await Runtime.evaluate({ expression, returnByValue: true, awaitPromise: true })
    return r.exceptionDetails ? { err: r.exceptionDetails.exception?.description } : r.result.value
  }

  // A placeholder key, never sent anywhere — fetch is replaced below. Without one
  // the page shows "Translation needs a DeepL key" and disables the button.
  await js(`localStorage.setItem('polucz_vocab', ${JSON.stringify(seedDeck)});
            localStorage.setItem('polucz_reviews', ${JSON.stringify(reviews)});
            localStorage.setItem('polucz_tours', ${JSON.stringify(tours)});
            localStorage.setItem('polucz_deepl_key', 'capture-fixture-not-a-key');
            localStorage.setItem('polucz_theme','${theme}')`)
  await Page.reload(); await Page.loadEventFired()
  await new Promise(r => setTimeout(r, 2600))

  await js(`(() => {
    const real = window.fetch
    const stub = ${JSON.stringify(STUB)}
    window.fetch = (url, opts) => {
      const path = String(url)
      for (const key of Object.keys(stub)) {
        if (path.includes(key)) {
          return Promise.resolve(new Response(JSON.stringify(stub[key]),
            { status: 200, headers: { 'Content-Type': 'application/json' } }))
        }
      }
      return real(url, opts)
    }
  })()`)

  // Nav: the translate page is the second item.
  await js(`[...document.querySelectorAll('span.material-symbols-rounded')].find(s => s.textContent.trim() === 'translate')?.closest('button')?.click()`)
  await new Promise(r => setTimeout(r, 1600))

  // React owns the field's value, so writing to .value directly is ignored —
  // the native setter plus an input event is what the component actually sees.
  await js(`(() => {
    const el = document.querySelector('textarea') || document.querySelector('input[type="text"]')
    if (!el) return 'no field'
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement
    Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, ${JSON.stringify(SENTENCE)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
  await new Promise(r => setTimeout(r, 700))
  await fullOf(Page, `screen-translate-typed${suffix}-${theme}`)

  await js(`[...document.querySelectorAll('button')].find(b => /^translate$/i.test(b.innerText.trim()))?.click()`)
  await new Promise(r => setTimeout(r, 2600))
  const got = await js(`/Bread kills birds/i.test(document.body.innerText)`)
  console.log('  translation rendered:', got)
  await fullOf(Page, `screen-translate-result${suffix}-${theme}`)

  const words = await js(`/zabijać/.test(document.body.innerText) && /ptak/.test(document.body.innerText)`)
  console.log('  word list rendered:', words)
  await fullOf(Page, `screen-translate-words${suffix}-${theme}`)

  await client.close()
}

async function fullOf(Page, name) {
  const { data } = await Page.captureScreenshot({ format: 'png', fromSurface: true })
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, 'base64'))
  console.log('  ✓', `${name}.png`)
}

for (const theme of ['light', 'dark']) {
  console.log('\n' + theme)
  await session(theme, async ({ shot, full, nav, js }) => {
    await full('screen-list')
    await shot('card', `document.querySelector('.card-cv')`)
    await shot('filter-pane', `window.__byText('10 words', 260)`)
    await shot('bottom-nav', `document.querySelector('[class*="fixed bottom-"]')`)

    // Word detail — open `trudny` specifically, not whichever card happens to sort
    // first: the landing copy names that table as its most convincing image.
    // The click handler sits on the inner .perspective element.
    await js(`[...document.querySelectorAll('.perspective')].find(e => /trudny/.test(e.innerText))?.click()`)
    await new Promise(r => setTimeout(r, 2000))
    const opened = await js(`/mianownik|dopełniacz|Examples|Forms/i.test(document.body.innerText)`)
    console.log('  detail modal open:', opened)
    if (opened) {
      await full('screen-detail')
      // The tightest element that still holds both the headword and the paradigm.
      // Matching on a class is brittle here — the modal's wrapper classes have
      // changed twice — whereas "the smallest box containing all of it" does not.
      await shot('word-detail', `
        (() => {
          const hit = [...document.querySelectorAll('div')].filter(el => {
            const t = el.innerText || ''
            return t.includes('difficult') && /STOPNIOWANIE|POJEDYNCZA|MIANOWNIK/i.test(t)
          })
          if (!hit.length) return null
          return hit.reduce((best, el) =>
            el.scrollHeight * el.scrollWidth < best.scrollHeight * best.scrollWidth ? el : best)
        })()`)
    }
    await js(`[...document.querySelectorAll('span.material-symbols-rounded')].find(s => s.textContent.trim() === 'close')?.closest('button')?.click()`)
    await new Promise(r => setTimeout(r, 1400))
    const stillOpen = await js(`/STOPNIOWANIE|POJEDYNCZA/i.test(document.body.innerText)`)
    if (stillOpen) console.log('  WARNING: modal did not close — later shots would be of it')

    await nav('dynamic_feed'); await full('screen-flashcards')
    await nav('question_mark'); await full('screen-quiz')
    await shot('quiz-modes', `window.__byText('Declension quiz', 200)`)
    await nav('spatial_audio'); await full('screen-audio')
  })
}

for (const theme of ['light', 'dark']) {
  console.log('\ntranslate ' + theme)
  // before: nothing kept yet, every word offers "+ Add card"
  await translateSession(theme, deckBeforeMining, '')
  // after: the two mined words are in, so they read "✓ In vocabulary"
  await translateSession(theme, deck, '-after')
}

// ─── A flashcard mid-review ──────────────────────────────────────────────────
// The flashcards screen opens on a group picker, and a panel captioned "now you
// are learning them" showing a menu is a caption describing a different image.
async function flashcardSession(theme) {
  const client = await CDP({ host: '127.0.0.1', port: 9222 })
  const { Page, Runtime, Emulation } = client
  await Page.enable(); await Runtime.enable()
  await Emulation.setDeviceMetricsOverride({ width: 430, height: 932, deviceScaleFactor: 3, mobile: true })
  await Page.navigate({ url: 'http://127.0.0.1:4173/' }); await Page.loadEventFired()
  const js = async (expression) => {
    const r = await Runtime.evaluate({ expression, returnByValue: true, awaitPromise: true })
    return r.exceptionDetails ? { err: r.exceptionDetails.exception?.description } : r.result.value
  }
  await js(`localStorage.setItem('polucz_vocab', ${JSON.stringify(deck)});
            localStorage.setItem('polucz_reviews', ${JSON.stringify(reviews)});
            localStorage.setItem('polucz_tours', ${JSON.stringify(tours)});
            localStorage.setItem('polucz_theme','${theme}')`)
  await Page.reload(); await Page.loadEventFired()
  await new Promise(r => setTimeout(r, 2600))

  await js(`[...document.querySelectorAll('span.material-symbols-rounded')].find(s => s.textContent.trim() === 'dynamic_feed')?.closest('button')?.click()`)
  await new Promise(r => setTimeout(r, 1600))
  await js(`[...document.querySelectorAll('button')].find(b => /go through everything/i.test(b.innerText))?.click()`)
  await new Promise(r => setTimeout(r, 2200))

  const inRun = await js(`!/or pick a group/i.test(document.body.innerText)`)
  console.log('  in a review run:', inRun)
  await fullOf(Page, `screen-flashcard-card-${theme}`)
  await client.close()
}

for (const theme of ['light', 'dark']) {
  console.log('\nflashcard ' + theme)
  await flashcardSession(theme)
}
