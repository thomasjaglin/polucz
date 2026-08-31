#!/usr/bin/env node
/**
 * Curation pass — the desktop half of docs/tiered-quiz-generation-plan.md §8.
 *
 * The app generates its own quiz questions now, so this no longer generates
 * anything. It does the one thing a phone cannot: run sentences through the full
 * LanguageTool rule engine and surface only what looks wrong.
 *
 *   generate in the app  ->  export  ->  curate here  ->  import back
 *
 * Setup (no Docker):
 *   brew install languagetool
 *   brew services start languagetool      # port 8081, restarts at login
 *
 * Usage:
 *   npm run curate                        # newest backup in ~/Downloads
 *   npm run curate -- --input path.json --lt http://localhost:8081
 *   npm run curate -- --all               # also check corpus sentences
 *
 * Only `generated` sentences are checked by default. Corpus sentences were
 * written by humans and are grammatical by construction — but see --all: they
 * can still be homographs, where the form matches by spelling and not by part of
 * speech, and LanguageTool is the only thing in this pipeline that could notice.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { parseArgs } from 'util'

const { values: args } = parseArgs({
  options: {
    input: { type: 'string' },
    output: { type: 'string' },
    lt: { type: 'string', default: 'http://localhost:8081' },
    all: { type: 'boolean', default: false },
  },
  strict: true,
})

const LT = args.lt.replace(/\/$/, '')
const DOWNLOADS = join(homedir(), 'Downloads')

// ─── Input ────────────────────────────────────────────────────────────────────

function newestBackup() {
  const files = readdirSync(DOWNLOADS)
    .filter(f => /^polucz-.*\.json$/.test(f) && !/curated/.test(f))
    .map(f => ({ f, path: join(DOWNLOADS, f), t: statSync(join(DOWNLOADS, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
  if (files.length === 0) {
    console.error(`No polucz-*.json in ${DOWNLOADS}. Export from the app first, or pass --input.`)
    process.exit(1)
  }
  return files[0].path
}

const inputPath = args.input ?? newestBackup()
let backup
try {
  backup = JSON.parse(readFileSync(inputPath, 'utf8'))
} catch (e) {
  console.error(`Cannot read ${inputPath}: ${e.message}`)
  process.exit(1)
}

// The app's import REPLACES rather than merges, so the output must be a complete
// backup. A sentences-only file would wipe the vocabulary on the way back in.
if (!Array.isArray(backup.cards) || typeof backup.reviews !== 'object') {
  console.error(`${inputPath} is not a Polucz backup (needs cards[] and reviews{}).`)
  process.exit(1)
}
const sentences = Array.isArray(backup.sentences) ? backup.sentences : []
if (sentences.length === 0) {
  console.error('This backup contains no sentences. Export again from a build that includes them.')
  process.exit(1)
}

// ─── LanguageTool ─────────────────────────────────────────────────────────────

async function check(text) {
  const res = await fetch(`${LT}/v2/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ language: 'pl', text }).toString(),
  })
  if (!res.ok) throw new Error(`LanguageTool returned ${res.status}`)
  const { matches = [] } = await res.json()
  // Style and typography are noise here; only real errors are worth a human's
  // attention, which is the whole point of reviewing a subset.
  return matches.filter(m =>
    m.rule?.issueType === 'grammar' || m.rule?.issueType === 'misspelling')
}

try {
  await check('To jest test.')
} catch (e) {
  console.error(`Cannot reach LanguageTool at ${LT}: ${e.message}`)
  console.error('Start it with:  brew install languagetool && brew services start languagetool')
  process.exit(1)
}

// ─── The pass ─────────────────────────────────────────────────────────────────

const inScope = sentences.filter(s => {
  if (!s.polish) return false                       // paradigm questions: nothing to check
  if (args.all) return true
  return s.source === 'generated'                   // default: only what a model wrote
})

console.log(`Input      : ${inputPath}`)
console.log(`Sentences  : ${sentences.length} total, ${inScope.length} in scope` +
            (args.all ? ' (--all)' : ' (generated only)'))
console.log(`LanguageTool: ${LT}\n`)

const flagged = []
for (let i = 0; i < inScope.length; i++) {
  const s = inScope[i]
  let matches
  try {
    matches = await check(s.polish)
  } catch (e) {
    console.error(`\n[LT_ERR] ${e.message} — stopping so the report is not misleadingly clean`)
    process.exit(1)
  }
  if (matches.length > 0) {
    flagged.push({
      id: s.id,
      lemma: s.cardLemma,
      form: s.targetForm,
      polish: s.polish,
      english: s.english ?? '',
      source: s.source ?? 'legacy',
      issues: matches.map(m => ({
        message: m.message,
        offset: m.offset,
        length: m.length,
        rule: m.rule?.id ?? '',
      })),
    })
  }
  if ((i + 1) % 25 === 0 || i + 1 === inScope.length) {
    process.stdout.write(`\r  checked ${i + 1}/${inScope.length}, flagged ${flagged.length}`)
  }
}
console.log('\n')

// ─── Output ───────────────────────────────────────────────────────────────────

const stamp = new Date().toISOString().slice(0, 10)
const reportPath = join(DOWNLOADS, `polucz-flagged-${stamp}.json`)
writeFileSync(reportPath, JSON.stringify({
  generated: new Date().toISOString(),
  sourceFile: inputPath,
  // The whole backup travels with the report so review.html can write a complete
  // file back without needing the original alongside it.
  backup,
  flagged,
}, null, 2), 'utf8')

console.log(`Flagged    : ${flagged.length} of ${inScope.length}` +
            (inScope.length ? ` (${Math.round(100 * flagged.length / inScope.length)}%)` : ''))
console.log(`Report     : ${reportPath}`)
console.log(flagged.length
  ? `\nOpen tools/review.html and load that file to review them.`
  : `\nNothing to review — every sentence in scope passed.`)
