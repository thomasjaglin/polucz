#!/usr/bin/env node
/**
 * Polish vocabulary — sentence generation script
 *
 * Reads a polon backup JSON, generates 3 candidate Polish example sentences
 * per grammatical form via Gemini, validates each with local LanguageTool,
 * and writes the first passing candidate to sentences.json.
 *
 * Requires:
 *   - GEMINI_API_KEY environment variable
 *   - LanguageTool running locally (docker run -d --name languagetool \
 *       -p 8010:8010 erikvl87/languagetool)
 *
 * Usage:
 *   node scripts/generate-sentences.js \
 *     --input polon-backup-2026-07-02.json \
 *     [--output sentences.json] \
 *     [--languagetool http://localhost:8010] \
 *     [--limit 50]
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { randomUUID } from 'crypto'
import { parseArgs } from 'util'

// ─── CLI ──────────────────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    input:        { type: 'string' },
    output:       { type: 'string', default: 'sentences.json' },
    languagetool: { type: 'string', default: 'http://localhost:8010' },
    limit:        { type: 'string' },
  },
  strict: true,
})

if (!args.input) {
  console.error('Usage: node scripts/generate-sentences.js --input <backup.json> [--output sentences.json] [--languagetool http://localhost:8010] [--limit 50]')
  process.exit(1)
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
if (!GEMINI_API_KEY) {
  console.error('Error: GEMINI_API_KEY environment variable is not set.')
  process.exit(1)
}

const LIMIT        = args.limit ? parseInt(args.limit, 10) : Infinity
const LT_BASE      = args.languagetool.replace(/\/$/, '')
const OUTPUT       = args.output

// ─── Known invalid lemmas — warn and skip ────────────────────────────────────

const FLAGGED_LEMMAS = new Set(['całatwienie'])

// ─── Grammar constants ────────────────────────────────────────────────────────

// v1: 4 priority cases per the spec
const NOUN_CASES = [
  { name: 'nominative',   index: 0 },
  { name: 'genitive',     index: 1 },
  { name: 'accusative',   index: 3 },
  { name: 'instrumental', index: 4 },
]

// Standard Polish pronoun labels for present-tense conjugation rows
const VERB_PRONOUNS = ['ja', 'ty', 'on/ona', 'my', 'wy', 'oni/one']

// v1: only nominative singular per gender for adjectives
const ADJ_GENDERS = ['masculine', 'feminine', 'neuter']

// ─── Resume ───────────────────────────────────────────────────────────────────

let sentences = []
const done = new Set()   // keys of already-written sentences

if (existsSync(OUTPUT)) {
  try {
    const existing = JSON.parse(readFileSync(OUTPUT, 'utf8'))
    sentences = Array.isArray(existing.sentences) ? existing.sentences : []
    for (const s of sentences) done.add(makeKey(s))
    console.log(`↩  Resuming — ${sentences.length} sentence${sentences.length !== 1 ? 's' : ''} already in ${OUTPUT}`)
  } catch {
    console.warn(`Warning: could not parse existing ${OUTPUT}, starting fresh.`)
  }
}

function makeKey(s) {
  if (s.cardType === 'noun')      return `${s.cardLemma}::noun::${s.targetCase}::${s.targetNumber}`
  if (s.cardType === 'verb')      return `${s.cardLemma}::verb::${s.targetPronoun}`
  if (s.cardType === 'adjective') return `${s.cardLemma}::adj::${s.targetGender}`
  return `${s.cardLemma}::${s.cardType}`
}

// ─── Incremental output ───────────────────────────────────────────────────────

function persist() {
  writeFileSync(OUTPUT, JSON.stringify({
    generated:  new Date().toISOString(),
    sourceFile: args.input,
    sentences,
  }, null, 2), 'utf8')
}

// ─── LanguageTool ─────────────────────────────────────────────────────────────

async function ltCheck(text) {
  const res = await fetch(`${LT_BASE}/v2/check`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({ language: 'pl', text }).toString(),
  })
  if (!res.ok) throw new Error(`LanguageTool returned ${res.status}`)
  const { matches = [] } = await res.json()
  // Only reject on genuine grammar/spelling errors — ignore style, whitespace, etc.
  const errors = matches.filter(m =>
    m.rule.issueType === 'grammar' || m.rule.issueType === 'misspelling'
  )
  return errors.length === 0
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions'

// Wrap candidates in an object — top-level arrays are not reliable in responseSchema
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          polish:  { type: 'string' },
          english: { type: 'string' },
        },
        required: ['polish', 'english'],
      },
    },
  },
  required: ['candidates'],
}

async function callGemini(systemInstruction, userInput) {
  let res
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(Math.pow(2, attempt - 1) * 1000)
    res = await fetch(GEMINI_URL, {
      method:  'POST',
      headers: { 'x-goog-api-key': GEMINI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:              'gemini-3.5-flash',
        system_instruction: systemInstruction,
        input:              userInput,
        response_format:    { type: 'text', mime_type: 'application/json', schema: RESPONSE_SCHEMA },
      }),
    })
    if (res.status !== 429) break
  }

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text().catch(() => '')}`)

  const data = await res.json()
  const text = data.steps
    ?.find(s => s.type === 'model_output')
    ?.content?.find(c => c.type === 'text')?.text

  if (!text) throw new Error('Empty response from Gemini')

  const parsed = JSON.parse(text)
  return Array.isArray(parsed.candidates) ? parsed.candidates : []
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

const SYS_NOUN = `\
You are a Polish language teacher creating example sentences for grammar exercises.
Given a noun form and its grammatical context, return a JSON object {"candidates": [...]} \
containing exactly 3 different natural Polish sentences (8–12 words each).
Each sentence must genuinely require the specified grammatical case — not optional usage.
Use common, everyday vocabulary. No complex or literary language.
Sentences must be factually correct and semantically sensible.
Do NOT use the word in a title, quotation, or list.
Each of the 3 sentences must differ in structure and meaning.
Each array item has "polish" and "english" keys.`

const SYS_VERB = `\
You are a Polish language teacher creating example sentences for grammar exercises.
Given a conjugated Polish verb form and its grammatical context, return a JSON object \
{"candidates": [...]} containing exactly 3 different natural Polish sentences (8–12 words each).
The exact verb form must appear in each sentence as written.
Use common, everyday vocabulary. Sentences must be factually correct and semantically sensible.
Do NOT use the verb in a title, quotation, or list.
Each of the 3 sentences must differ in structure and meaning.
Each array item has "polish" and "english" keys.`

const SYS_ADJ = `\
You are a Polish language teacher creating example sentences for grammar exercises.
Given a Polish adjective form and its grammatical context, return a JSON object \
{"candidates": [...]} containing exactly 3 different natural Polish sentences (8–12 words each).
The adjective must be in the nominative case (subject position) and agree with a noun of the specified gender.
Use common, everyday vocabulary. Sentences must be factually correct and semantically sensible.
Each of the 3 sentences must differ in structure and meaning.
Each array item has "polish" and "english" keys.`

function nounInput(form, lemma, en, caseName, number) {
  return `Word: "${form}" — ${caseName} ${number} of "${lemma}" (English: "${en}"). The ${caseName} case must be grammatically required by the sentence structure.`
}

function verbInput(form, lemma, en, pronoun) {
  return `Verb form: "${form}" — ${pronoun} present tense of "${lemma}" (English: "${en}"). This exact form must appear in each sentence.`
}

function adjInput(form, lemma, en, gender) {
  return `Adjective form: "${form}" — nominative singular ${gender} of "${lemma}" (English: "${en}"). Must be in subject/nominative position, agreeing with a ${gender} noun.`
}

// ─── Core: generate + validate one form ──────────────────────────────────────

async function processForm(systemPrompt, userInput, base) {
  const key = makeKey(base)
  if (done.has(key)) return 'resumed'

  await sleep(500)   // pace Gemini calls

  let candidates
  try {
    candidates = await callGemini(systemPrompt, userInput)
  } catch (e) {
    console.error(`  [GEMINI_ERR] ${base.cardLemma} [${base.targetForm}]: ${e.message}`)
    return 'error'
  }

  if (candidates.length === 0) {
    console.warn(`  [NO_CANDIDATES] ${base.cardLemma} [${base.targetForm}]: Gemini returned empty list`)
    return 'no_valid'
  }

  for (const c of candidates) {
    if (!c.polish?.trim() || !c.english?.trim()) continue
    let passed
    try {
      passed = await ltCheck(c.polish)
    } catch (e) {
      console.error(`  [LT_ERR] ${e.message}`)
      return 'error'
    }
    if (passed) {
      const sentence = {
        id: randomUUID(),
        ...base,
        polish:             c.polish.trim(),
        english:            c.english.trim(),
        languageToolPassed: true,
        approved:           false,
      }
      sentences.push(sentence)
      done.add(key)
      persist()
      console.log(`  ✓  [${base.targetForm}]  ${c.polish}`)
      return 'ok'
    }
  }

  console.warn(`  [NO_VALID] ${base.cardLemma} [${base.targetForm}]: all ${candidates.length} candidates rejected by LanguageTool`)
  return 'no_valid'
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Read backup
  let backup
  try {
    backup = JSON.parse(readFileSync(args.input, 'utf8'))
  } catch (e) {
    console.error(`Cannot read ${args.input}: ${e.message}`)
    process.exit(1)
  }
  const cards = backup.cards ?? []
  console.log(`Loaded ${cards.length} cards from ${args.input}\n`)

  // Verify LanguageTool is up
  try {
    await ltCheck('To jest test.')
    console.log(`LanguageTool ready at ${LT_BASE}`)
  } catch (e) {
    console.error(`Cannot reach LanguageTool at ${LT_BASE}: ${e.message}`)
    console.error('Start it with:  docker run -d --name languagetool -p 8010:8010 erikvl87/languagetool')
    process.exit(1)
  }

  let generated = 0
  let noValid   = 0
  const cardSkips = []

  for (const card of cards) {
    if (generated >= LIMIT) break

    // Flagged invalid lemmas
    if (FLAGGED_LEMMAS.has(card.id)) {
      console.warn(`\n[FLAGGED] "${card.id}" is not a valid Polish lemma — delete this card in the app before running the script.`)
      continue
    }

    // Type/enrichment gates
    if (card.type === 'unknown') { cardSkips.push(`${card.id} — unknown type`);  continue }
    if (!card.enriched)          { cardSkips.push(`${card.id} — not enriched`);   continue }

    // ── Verb ──────────────────────────────────────────────────────────────────

    if (card.type === 'verb') {
      if (!Array.isArray(card.conjugations?.present)) {
        cardSkips.push(`${card.id} — missing conjugations.present`)
        continue
      }
      console.log(`\nVerb: ${card.id}  (${card.en})`)

      for (let i = 0; i < 6 && generated < LIMIT; i++) {
        const form = card.conjugations.present[i]?.trim()
        if (!form || form === '—') { console.warn(`  [SKIP] present[${i}] is empty`); continue }

        const result = await processForm(
          SYS_VERB,
          verbInput(form, card.id, card.en, VERB_PRONOUNS[i]),
          {
            cardLemma:    card.id,
            cardType:     'verb',
            targetForm:   form,
            targetPronoun: VERB_PRONOUNS[i],
            targetTense:  'present',
          },
        )
        if (result === 'ok')       generated++
        else if (result === 'no_valid') noValid++
      }
    }

    // ── Noun ──────────────────────────────────────────────────────────────────

    else if (card.type === 'noun') {
      if (!card.declensions) {
        cardSkips.push(`${card.id} — missing declensions`)
        continue
      }
      console.log(`\nNoun: ${card.id}  (${card.en})`)

      for (const { name: caseName, index } of NOUN_CASES) {
        for (const number of ['singular', 'plural']) {
          if (generated >= LIMIT) break
          const table = number === 'singular' ? card.declensions.singular : card.declensions.plural
          const form  = table?.[index]?.trim()
          if (!form || form === '—') { console.warn(`  [SKIP] ${caseName} ${number} is empty`); continue }

          const result = await processForm(
            SYS_NOUN,
            nounInput(form, card.id, card.en, caseName, number),
            {
              cardLemma:    card.id,
              cardType:     'noun',
              targetForm:   form,
              targetCase:   caseName,
              targetNumber: number,
            },
          )
          if (result === 'ok')            generated++
          else if (result === 'no_valid') noValid++
        }
      }
    }

    // ── Adjective ─────────────────────────────────────────────────────────────

    else if (card.type === 'adjective') {
      if (!card.declensions) {
        cardSkips.push(`${card.id} — missing declensions`)
        continue
      }
      console.log(`\nAdjective: ${card.id}  (${card.en})`)

      for (const gender of ADJ_GENDERS) {
        if (generated >= LIMIT) break
        // nominative singular = index 0 in each gender column
        const raw  = card.declensions[gender]?.[0]?.trim()
        // Some accusative masculine forms are "pięknego/piękny" — for nominative
        // this shouldn't occur, but strip any slash-alternates defensively
        const form = raw?.split('/')[0].trim()
        if (!form || form === '—') { console.warn(`  [SKIP] nom sg ${gender} is empty`); continue }

        const result = await processForm(
          SYS_ADJ,
          adjInput(form, card.id, card.en, gender),
          {
            cardLemma:    card.id,
            cardType:     'adjective',
            targetForm:   form,
            targetGender: gender,
            targetCase:   'nominative',
            targetNumber: 'singular',
          },
        )
        if (result === 'ok')            generated++
        else if (result === 'no_valid') noValid++
      }
    }
  }

  // ─── Summary ─────────────────────────────────────────────────────────────────
  const hr = '─'.repeat(56)
  console.log(`\n${hr}`)
  console.log(`Generated this run :  ${generated}`)
  console.log(`Total in file      :  ${sentences.length}`)
  console.log(`No valid sentence  :  ${noValid} form(s) — all candidates rejected`)
  if (cardSkips.length) {
    console.log(`Cards skipped      :  ${cardSkips.length}`)
    for (const s of cardSkips) console.log(`  • ${s}`)
  }
  console.log(`Output             :  ${OUTPUT}`)
  console.log(hr)
}

main().catch(e => {
  console.error('\nFatal error:', e.message)
  process.exit(1)
})
