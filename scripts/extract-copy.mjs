#!/usr/bin/env node
/**
 * Pulls every user-facing string out of the app into docs/ui-copy.json.
 *
 * Not an i18n catalogue — the app still owns its strings. This is a lens for
 * reading all the copy at once, which is the only way to notice that two
 * screens say the same thing differently, or that half the buttons end in a
 * full stop and half do not.
 *
 * Usage:  npm run copy:extract        (writes the file, prints a report)
 *
 * What counts as copy: JSX text nodes, and string literals passed to props that
 * carry words (title, label, hint, placeholder, text, blurb, footnote,
 * aria-label) or to pushToast. What does not: class names, Material Symbols
 * ligatures, storage keys, and anything without a letter in it.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const SRC = 'src'
const OUT = 'docs/ui-copy.json'

// Props whose string value is shown to a person.
const COPY_PROPS = ['title', 'label', 'hint', 'placeholder', 'text', 'blurb', 'footnote', 'aria-label', 'nextLabel', 'desc']

// Material Symbols ligatures sit in JSX text exactly where copy does.
const LIGATURE = /^[a-z_0-9]+$/

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

/** A rough screen name, so the report groups the way a user would see it. */
function screenOf(file) {
  const f = relative(SRC, file).replace(/\.tsx?$/, '')
  if (f.startsWith('components/tour/') || f === 'data/tourFixture') return 'Onboarding'
  if (f.startsWith('components/quiz/') || f === 'components/QuizPage') return 'Quiz'
  if (/Flashcard/.test(f)) return 'Flashcards'
  if (/Audio/.test(f)) return 'Pronunciation'
  if (/Translate/.test(f)) return 'Translate'
  if (/VocabList|VocabCard|WordDetail/.test(f)) return 'Vocabulary'
  if (/ApiConfig/.test(f)) return 'Settings'
  if (/Help/.test(f)) return 'Help'
  if (/AddVocab/.test(f)) return 'Add a word'
  if (/TopHeader/.test(f)) return 'Menu & backup'
  if (/Empty/.test(f)) return 'Empty states'
  return 'Shared'
}

const clean = s => s.replace(/\s+/g, ' ').trim()

// Expressions leak through the JSX-text pattern: `>= 0 && next<` and friends.
const CODEY = /(&&|\|\||=>|===|!==|\?\.|\$\{.*\}\s*$|^[=<>+\-*/%]|^\w+\(|\bprops\b)/
const isCopy = s =>
  /[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]/.test(s) &&
  !LIGATURE.test(s) &&
  s.length > 1 &&
  !CODEY.test(s)

const entries = []
const add = (file, line, kind, text) => {
  const t = clean(text)
  if (!isCopy(t)) return
  entries.push({ screen: screenOf(file), file: relative('.', file), line, kind, text: t })
}

for (const file of walk(SRC)) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((raw, i) => {
    const line = i + 1

    // Skip comments, imports and class strings outright.
    const trimmed = raw.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
    if (/^import /.test(trimmed)) return

    // JSX text between tags: >Some words<
    for (const m of raw.matchAll(/>([^<>{}\n]{2,})</g)) add(file, line, 'text', m[1])

    // Copy-bearing props, single or double quoted.
    for (const prop of COPY_PROPS) {
      const re = new RegExp(`\\b${prop}=(?:"([^"]{2,})"|'([^']{2,})')`, 'g')
      for (const m of raw.matchAll(re)) add(file, line, prop, m[1] ?? m[2])
      const objRe = new RegExp(`\\b${prop}:\\s*(?:'([^']{2,})'|"([^"]{2,})")`, 'g')
      for (const m of raw.matchAll(objRe)) add(file, line, prop, m[1] ?? m[2])
    }

    // Toasts are copy the user reads at the worst moment, so they matter most.
    for (const m of raw.matchAll(/pushToast\(\s*(?:'([^']+)'|"([^"]+)"|`([^`]+)`)/g)) {
      add(file, line, 'toast', m[1] ?? m[2] ?? m[3])
    }
  })
}

// ── The analysis half ────────────────────────────────────────────────────────

const byText = new Map()
for (const e of entries) {
  const k = e.text.toLowerCase()
  ;(byText.get(k) ?? byText.set(k, []).get(k)).push(e)
}

/** Same words, different capitalisation or punctuation — the usual drift. */
const nearDuplicates = []
const seen = new Set()
for (const e of entries) {
  const norm = e.text.toLowerCase().replace(/[.!…]+$/, '').trim()
  if (norm.length < 4 || seen.has(norm)) continue
  const variants = [...new Set(entries.filter(x =>
    x.text.toLowerCase().replace(/[.!…]+$/, '').trim() === norm).map(x => x.text))]
  if (variants.length > 1) { nearDuplicates.push({ variants }); seen.add(norm) }
}

// Short strings behave like labels, and labels are where style drift shows.
const labels = entries.filter(e =>
  ['label', 'nextLabel'].includes(e.kind) || (e.kind === 'text' && e.text.split(' ').length <= 4))

const isTitleCase = t => {
  const words = t.split(/\s+/).filter(w => w && /[A-Za-z]/.test(w[0]))
  return words.length >= 2 && words.every(w => w[0] === w[0].toUpperCase())
}

const ellipsisDots = entries.filter(e => e.text.includes('...'))
const ellipsisChar = entries.filter(e => e.text.includes('…'))
const titleCase = labels.filter(e => isTitleCase(e.text))
const labelsWithStop = labels.filter(e => /[.]$/.test(e.text) && e.text.split(' ').length <= 5)

const report = {
  generated: new Date().toISOString().slice(0, 10),
  counts: {
    strings: entries.length,
    byScreen: Object.fromEntries(
      [...new Set(entries.map(e => e.screen))].sort()
        .map(s => [s, entries.filter(e => e.screen === s).length])),
  },
  observations: {
    // Same words, different capitalisation or punctuation.
    nearDuplicates,
    // Two ways of writing the same pause. One of them should win.
    ellipsis: {
      threeDots: ellipsisDots.map(e => ({ text: e.text, file: e.file, line: e.line })),
      character: ellipsisChar.map(e => ({ text: e.text, file: e.file, line: e.line })),
    },
    // Title Case among labels, where the newer screens use sentence case.
    // Brand names and acronyms will show up here and are fine.
    titleCaseLabels: titleCase.map(e => ({ text: e.text, file: e.file, line: e.line })),
    // A button is not a sentence.
    labelsEndingInAFullStop: labelsWithStop.map(e => ({ text: e.text, file: e.file, line: e.line })),
  },
  copy: entries.sort((a, b) =>
    a.screen.localeCompare(b.screen) || a.file.localeCompare(b.file) || a.line - b.line),
}

writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n', 'utf8')

console.log(`${entries.length} strings → ${OUT}\n`)
for (const [screen, n] of Object.entries(report.counts.byScreen)) {
  console.log(`  ${screen.padEnd(18)} ${n}`)
}
console.log(`\nnear-duplicates (same words, different form): ${nearDuplicates.length}`)
for (const d of nearDuplicates.slice(0, 12)) console.log('  ' + d.variants.map(v => `"${v}"`).join('  vs  '))
console.log(`\nellipsis: "..." x${ellipsisDots.length}, "…" x${ellipsisChar.length}`)
console.log(`Title Case labels: ${titleCase.length}`)
for (const e of titleCase.slice(0, 10)) console.log(`  "${e.text}"  ${e.file.split('/').pop()}:${e.line}`)
console.log(`labels ending in a full stop: ${labelsWithStop.length}`)
for (const e of labelsWithStop) console.log(`  "${e.text}"  ${e.file.split('/').pop()}:${e.line}`)
