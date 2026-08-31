#!/usr/bin/env node
/**
 * Builds public/pol-corpus.txt — the Tatoeba Polish snapshot tier 1 searches.
 *
 * Tatoeba publishes weekly per-language exports and states that bulk download,
 * not the search API, is the intended path for language tools. Searching the
 * live API per form also has latency swinging from 0.3s to over 10s, which makes
 * it unusable for anything but a single form at a time.
 *
 * Output is one sentence per line, pruned to what could actually carry a quiz
 * question (see src/lib/questionChecks.ts). Roughly 4.7MB raw, ~1.8MB in the APK.
 *
 * Data: CC BY 2.0 FR — attribution to Tatoeba is required wherever these
 * sentences are shown. See public/pol-corpus.LICENCE.txt.
 *
 * Usage:  node scripts/build-corpus.mjs        (needs network + bunzip2)
 */
import { execFileSync } from 'child_process'
import { writeFileSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const SRC = 'https://downloads.tatoeba.org/exports/per_language/pol/pol_sentences.tsv.bz2'
const OUT = new URL('../public/pol-corpus.txt', import.meta.url).pathname

// Must stay in step with questionChecks.ts — a sentence outside this band would
// be shipped and then rejected at question time, which is just dead weight.
const MIN_WORDS = 3, MAX_WORDS = 18, MAX_CHARS = 160
const ENDS_SENTENCE = /[.!?…]["'»)]?$/

const res = await fetch(SRC)
if (!res.ok) throw new Error(`Tatoeba returned ${res.status}`)
const dir = mkdtempSync(join(tmpdir(), 'polucz-corpus-'))
const bz2 = join(dir, 'pol.tsv.bz2')
writeFileSync(bz2, Buffer.from(await res.arrayBuffer()))
// No bzip2 in Node; the system tool is present on macOS and Linux.
const tsv = execFileSync('bunzip2', ['-c', bz2], { maxBuffer: 1 << 28 }).toString('utf8')

let total = 0
const kept = []
for (const line of tsv.split('\n')) {
  const parts = line.split('\t')
  if (parts.length < 3) continue
  total++
  const text = parts[2].trim()
  const words = text.split(/\s+/).filter(Boolean).length
  if (words < MIN_WORDS || words > MAX_WORDS || text.length > MAX_CHARS) continue
  if (!ENDS_SENTENCE.test(text)) continue
  kept.push(text)
}

writeFileSync(OUT, kept.join('\n'), 'utf8')
console.log(`${kept.length.toLocaleString()} of ${total.toLocaleString()} sentences kept -> public/pol-corpus.txt`)
