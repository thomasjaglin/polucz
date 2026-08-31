import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// Guards the contrast pass. The alphas below 55% were not a one-off mistake —
// they were the house style for two years, so the pattern comes back unless
// something fails when it does.
//
// The numbers: light-theme ink (#0F172A) on the light page (#F7F4F1) reaches
// WCAG AA for small text at 55% alpha and no lower. Anything quieter is either
// unreadable or is not text, and non-text belongs in .ink-glyph.

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) sources(p, out)
    else if (/\.tsx$/.test(name)) out.push(p)
  }
  return out
}

const files = sources('src')

describe('text contrast', () => {
  it('has no ink text below the readable threshold', () => {
    const found: string[] = []
    for (const f of files) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        for (const m of line.matchAll(/text-ink\/(\d+)/g)) {
          if (Number(m[1]) <= 55) found.push(`${f}:${i + 1}  ${m[0]}`)
        }
      })
    }
    expect(found, 'use .ink-tertiary for quiet text, or .ink-glyph for non-text glyphs').toEqual([])
  })

  // Accent is the weaker colour of the two and fails sooner: at /70 it is
  // 4.07:1 on the light page. Icons may sit lower — 3:1 is the bar for non-text
  // — which is why this only looks at lines without an icon class.
  it('has no accent text below the readable threshold', () => {
    const found: string[] = []
    for (const f of files) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (line.includes('material-symbols-rounded')) return
        for (const m of line.matchAll(/text-accent\/(\d+)/g)) {
          if (Number(m[1]) < 80) found.push(`${f}:${i + 1}  ${m[0]}`)
        }
      })
    }
    expect(found, 'accent text needs /80 or more to pass AA in the light theme').toEqual([])
  })

  it('defines both tone tiers for both themes', () => {
    const css = readFileSync('src/index.css', 'utf8')
    for (const rule of [
      '.ink-tertiary',
      'html.theme-light .ink-tertiary',
      '.ink-glyph',
      'html.theme-light .ink-glyph',
      '.placeholder-tertiary::placeholder',
      'html.theme-light .placeholder-tertiary::placeholder',
    ]) {
      expect(css, rule).toContain(rule)
    }
  })
})
