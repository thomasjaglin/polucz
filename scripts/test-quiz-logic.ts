/**
 * Inline tests for src/lib/quizLogic.ts
 * Run with:  npx tsx scripts/test-quiz-logic.ts
 */

import { checkAnswer, getSessionQuestions, getDistractors } from '../src/lib/quizLogic'
import type { SentenceEntry, ReviewState } from '../src/data/types'

// ─── Minimal test harness ─────────────────────────────────────────────────────

let passed = 0
let failed = 0

function expect(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    console.log(`  ✓  ${label}`)
    passed++
  } else {
    console.error(`  ✗  ${label}`)
    console.error(`       expected: ${JSON.stringify(expected)}`)
    console.error(`       received: ${JSON.stringify(actual)}`)
    failed++
  }
}

function expectTrue(label: string, value: boolean)  { expect(label, value, true) }
function expectFalse(label: string, value: boolean) { expect(label, value, false) }

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const noun = (id: string, lemma: string, form: string, cas: string, num: string, approved = true): SentenceEntry => ({
  id, cardLemma: lemma, cardType: 'noun',
  targetForm: form, targetCase: cas, targetNumber: num,
  polish: `Zdanie z ${form}.`, english: 'A sentence.', languageToolPassed: true, approved,
})

const verb = (id: string, lemma: string, form: string, pronoun: string, approved = true): SentenceEntry => ({
  id, cardLemma: lemma, cardType: 'verb',
  targetForm: form, targetPronoun: pronoun, targetTense: 'present',
  polish: `${form} coś.`, english: 'Does something.', languageToolPassed: true, approved,
})

const adj = (id: string, lemma: string, form: string, gender: string, approved = true): SentenceEntry => ({
  id, cardLemma: lemma, cardType: 'adjective',
  targetForm: form, targetGender: gender, targetCase: 'nominative', targetNumber: 'singular',
  polish: `${form} coś.`, english: 'Something.', languageToolPassed: true, approved,
})

const review = (ease: number): ReviewState => ({
  interval: 1, easeFactor: ease, dueDate: '2026-07-03',
  lastReviewed: '2026-07-02', reviewCount: 3,
})

// ─── checkAnswer ──────────────────────────────────────────────────────────────

console.log('\ncheckAnswer')

expectTrue ('exact match',               checkAnswer('mówię',     'mówię'))
expectTrue ('case-insensitive',          checkAnswer('Mówię',     'mówię'))
expectTrue ('trailing space',            checkAnswer('mówię ',    'mówię'))
expectTrue ('leading + trailing spaces', checkAnswer('  mówię  ', 'mówię'))
expectTrue ('all-caps',                  checkAnswer('KOTÓW',     'kotów'))
expectFalse('missing diacritic',         checkAnswer('mowie',     'mówię'))
expectFalse('wrong form',               checkAnswer('mówisz',    'mówię'))
expectFalse('empty string',             checkAnswer('',           'mówię'))
expectFalse('partial match',            checkAnswer('mów',        'mówię'))

// ─── getSessionQuestions ──────────────────────────────────────────────────────

console.log('\ngetSessionQuestions')

const mixed: SentenceEntry[] = [
  noun('n1', 'kot',    'kota',    'genitive',     'singular'),
  noun('n2', 'dom',    'domu',    'genitive',     'singular'),
  noun('n3', 'ptak',   'ptaka',   'genitive',     'singular'),
  noun('n4', 'lek',    'leku',    'genitive',     'singular'),
  noun('n5', 'ryż',    'ryżu',    'genitive',     'singular'),
  verb('v1', 'mówić',  'mówię',   'ja'),
  verb('v2', 'sądzić', 'sądzę',   'ja'),
  noun('n6', 'złość',  'złości',  'genitive',     'singular', false),  // not approved
]

const noReviews: Record<string, ReviewState> = {}

// Type filtering
const declResult = getSessionQuestions('declension', 10, mixed, noReviews)
expectTrue('declension: no verbs',     declResult.every(s => s.cardType !== 'verb'))
expectTrue('declension: only nouns+adj', declResult.every(s => s.cardType === 'noun' || s.cardType === 'adjective'))

const conjResult = getSessionQuestions('conjugation', 10, mixed, noReviews)
expectTrue('conjugation: only verbs',  conjResult.every(s => s.cardType === 'verb'))

// Approved filter
expectFalse('unapproved sentence excluded', declResult.some(s => s.id === 'n6'))

// Count cap
const capped = getSessionQuestions('declension', 3, mixed, noReviews)
expectTrue('respects count limit',     capped.length === 3)

// Returns all when fewer than count
const small = getSessionQuestions('declension', 10, [
  noun('n1', 'kot', 'kota', 'genitive', 'singular'),
  noun('n2', 'dom', 'domu', 'genitive', 'singular'),
], noReviews)
expectTrue('returns all when pool < count', small.length === 2)

// Empty pool
const empty = getSessionQuestions('declension', 10, [], noReviews)
expectTrue('empty pool returns []', empty.length === 0)

// No duplicates
const ids = declResult.map(s => s.id)
expectTrue('no duplicate ids in session', new Set(ids).size === ids.length)

// Weighting: run 200 sessions of 1 question and confirm harder card appears more often
// Harder card: easeFactor 1.3  |  Easier card: easeFactor 3.0
const hardCard = noun('hard', 'trudny', 'trudnego', 'genitive', 'singular')
const easyCard = noun('easy', 'łatwy',  'łatwego',  'genitive', 'singular')
const weightReviews = { trudny: review(1.3), łatwy: review(3.0) }
let hardCount = 0
for (let i = 0; i < 400; i++) {
  const r = getSessionQuestions('declension', 1, [hardCard, easyCard], weightReviews)
  if (r[0]?.cardLemma === 'trudny') hardCount++
}
// With ease 1.3 vs 3.0, hard card should win substantially more than 50% of draws
expectTrue(`weighting: hard card selected ${hardCount}/400 times (expect >240)`, hardCount > 240)

// ─── getDistractors ───────────────────────────────────────────────────────────

console.log('\ngetDistractors')

const pool: SentenceEntry[] = [
  noun('n1', 'kot',     'kota',    'genitive', 'singular'),  // same case+number — priority 1
  noun('n2', 'dom',     'domu',    'genitive', 'singular'),  // same case+number — priority 1
  noun('n3', 'ptak',    'ptaka',   'genitive', 'singular'),  // same case+number — priority 1
  noun('n4', 'lek',     'leku',    'genitive', 'singular'),  // same case+number — priority 1
  noun('n5', 'ryż',     'ryżu',    'nominative', 'singular'),// different case — priority 2
  noun('n6', 'książka', 'książkę', 'accusative', 'singular'),// different case — priority 2
  verb('v1', 'mówić',   'mówię',   'ja'),                   // wrong type — excluded
]

const correctSentence = noun('cx', 'złość', 'złości', 'genitive', 'singular')
const distractors = getDistractors(correctSentence, 'genitive', pool, 3)

expectTrue ('returns 3 distractors',              distractors.length === 3)
expectFalse('never includes correct form',        distractors.includes('złości'))
expectFalse('never includes verb form',           distractors.includes('mówię'))
expectTrue ('all distractors are strings',        distractors.every(d => typeof d === 'string'))
expectTrue ('no duplicate forms',                 new Set(distractors).size === distractors.length)
expectTrue ('priority-1 forms preferred',         distractors.some(d => ['kota','domu','ptaka','leku'].includes(d)))

// Same lemma exclusion: only 1 other noun exists in pool, should still return it
const tinyPool: SentenceEntry[] = [
  noun('x1', 'dom', 'domu', 'genitive', 'singular'),
]
const tinyResult = getDistractors(correctSentence, 'genitive', tinyPool, 3)
expectTrue ('returns fewer when pool exhausted', tinyResult.length === 1)
expectTrue ('still excludes correct form',       !tinyResult.includes('złości'))

// Adjective distractors use gender matching
const adjPool: SentenceEntry[] = [
  adj('a1', 'piękny',    'piękny',    'masculine'),  // same gender — p1
  adj('a2', 'prosty',    'prosty',    'masculine'),  // same gender — p1
  adj('a3', 'szalony',   'szalona',   'feminine'),   // wrong gender — p2
  adj('a4', 'podły',     'podła',     'feminine'),   // wrong gender — p2
]
const correctAdj = adj('ca', 'uroczy', 'uroczy', 'masculine')
const adjDistractors = getDistractors(correctAdj, 'nominative', adjPool, 3)
expectTrue ('adj: no correct form',              !adjDistractors.includes('uroczy'))
expectTrue ('adj: priority prefers same gender', adjDistractors.some(d => d === 'piękny' || d === 'prosty'))
expectTrue ('adj: fills from other gender if needed', adjDistractors.length === 3)

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(44)}`)
console.log(`${passed + failed} tests   ✓ ${passed} passed   ${failed > 0 ? `✗ ${failed} failed` : ''}`)
console.log('─'.repeat(44))
if (failed > 0) process.exit(1)
