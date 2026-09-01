import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { BUNDLED_ICONS } from './data/bundledIcons'

// The icon font is subset to the icons the app names, so an icon added after
// the last `npm run fonts` is not merely missing — Material Symbols is a
// ligature font, so it renders as its own NAME. A build once shipped with the
// word SEARCH sitting where the magnifying glass belonged, and nothing but
// looking at the app offline would have caught it.
//
// This uses the same over-broad scan the generator does, on purpose: it is not
// trying to prove the scan is right, only that the font was rebuilt after the
// source last changed.

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return sourceFiles(p)
    return /\.tsx?$/.test(name) && !/\.test\.ts$/.test(name) ? [p] : []
  })
}

describe('bundled icon font', () => {
  it('contains every Material Symbol the source names', () => {
    const token = /['"><}\s]([a-z][a-z_]{2,})['"<{\s]/g
    const named = new Set<string>()
    for (const f of sourceFiles('src')) {
      for (const m of readFileSync(f, 'utf8').matchAll(token)) named.add(m[1])
    }

    // Only names the font actually knows about are icons; everything else is
    // prose. BUNDLED_ICONS is that filtered set from the last generator run, so
    // anything here that is a plausible icon but absent means a stale font.
    const suspicious = [...named].filter(n =>
      n.includes('_') && !BUNDLED_ICONS.has(n) &&
      // Storage keys and app-internal identifiers are snake_case too.
      !n.startsWith('polucz') && !n.startsWith('polon'))

    // Known non-icon snake_case identifiers, listed so a genuinely new one has
    // to be looked at rather than silently tolerated.
    const allowed = new Set([
      'add_page', 'api_config', 'not_configured', 'rate_limited', 'json_schema',
      'max_tokens', 'model_output', 'dynamic_feed', 'question_mark',
      'spatial_audio', 'specular_faded', 'specular_layer', 'specular_raw',
    ])
    const unexpected = suspicious.filter(n => !allowed.has(n))

    expect(unexpected, `Not in the bundled icon font. If these are icons, run ` +
      `\`npm run fonts\`; if not, add them to the allow-list in this test.`)
      .toEqual([])
  })

  it('has icons at all, so a broken generator run cannot pass silently', () => {
    expect(BUNDLED_ICONS.size).toBeGreaterThan(100)
    for (const core of ['search', 'close', 'delete', 'settings', 'help']) {
      expect(BUNDLED_ICONS.has(core), `${core} missing from the subset`).toBe(true)
    }
  })
})
