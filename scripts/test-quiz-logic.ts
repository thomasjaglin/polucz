/**
 * Inline tests for src/lib/quizLogic.ts
 * Run with:  npx tsx scripts/test-quiz-logic.ts
 */

import { checkAnswer, getSessionQuestions, getDistractors } from '../src/lib/quizLogic'
import type { SentenceEntry, ReviewState, VocabNoun } from '../src/data/types'

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

// NounDeclensions cases array always follows this order (from enrich-card)
// [mianownik, dopełniacz, celownik, biernik, narzędnik, miejscownik, wołacz]
// [nom[0],    gen[1],     dat[2],   acc[3],  inst[4],   loc[5],      voc[6] ]

function makeNounCard(id: string, sg: string[], pl: string[]): VocabNoun {
  return {
    id, type: 'noun', enriched: true, pl: id, en: id, left: '', right: '', tags: ['noun'],
    gender: 'm', plAlt: '',
    declensions: {
      cases: ['mianownik','dopełniacz','celownik','biernik','narzędnik','miejscownik','wołacz'],
      singular: sg,
      plural: pl,
    },
  }
}

// książka — classic feminine noun with syncretism:
//   gen.sg = nom.pl = acc.pl = voc.pl = 'książki'
//   dat.sg = loc.sg = 'książce'
const ksiazkaSg = ['książka', 'książki',  'książce', 'książkę',  'książką',   'książce',   'książko']
const ksiazkaPl = ['książki', 'książek',  'książkom','książki',  'książkami', 'książkach', 'książki']
const ksiazkaCard = makeNounCard('książka', ksiazkaSg, ksiazkaPl)

// dom — masculine noun
const domSg = ['dom', 'domu', 'domowi', 'dom',  'domem', 'domu',  'domu']
const domPl = ['domy','domów','domom',  'domy', 'domami','domach','domy']
const domCard = makeNounCard('dom', domSg, domPl)

const cards = [ksiazkaCard, domCard]

// ── genitive singular of 'książka' ──────────────────────────────────────────
// Correct: 'książki' (singular[1])
// Confusion map: [nom.pl, dat.sg, acc.sg]
//   nom.pl  → plural[0]   = 'książki'  ← syncretic! must be skipped
//   dat.sg  → singular[2] = 'książce'  ← unique, included
//   acc.sg  → singular[3] = 'książkę'  ← unique, included
// Fallback continues until count=3: next unique slot is loc.sg = 'książce' ← syncretic with dat.sg
//   inst.sg → singular[4] = 'książką'  ← unique, included  (fills count)

const correctGenSg = noun('s1', 'książka', 'książki', 'genitive', 'singular')
const genSgDistractors = getDistractors(correctGenSg, 'genitive', cards, 3)

expectTrue ('gen.sg: returns 3',                genSgDistractors.length === 3)
expectFalse('gen.sg: never includes correct',   genSgDistractors.includes('książki'))
expectTrue ('gen.sg: dat.sg included',          genSgDistractors.includes('książce'))
expectTrue ('gen.sg: acc.sg included',          genSgDistractors.includes('książkę'))
expectTrue ('gen.sg: no duplicates',            new Set(genSgDistractors).size === 3)

// ── nominative singular of 'dom' ─────────────────────────────────────────────
// Correct: 'dom' (singular[0])
// Confusion map: [gen.sg, acc.sg, nom.pl]
//   gen.sg  → singular[1] = 'domu' ← unique
//   acc.sg  → singular[3] = 'dom'  ← syncretic with correct! skipped
//   nom.pl  → plural[0]   = 'domy' ← unique
// Fallback: dat.sg → singular[2] = 'domowi' ← unique, fills count=3

const correctNomSg = noun('s2', 'dom', 'dom', 'nominative', 'singular')
const nomSgDistractors = getDistractors(correctNomSg, 'nominative', cards, 3)

expectTrue ('nom.sg: returns 3',                nomSgDistractors.length === 3)
expectFalse('nom.sg: never includes correct',   nomSgDistractors.includes('dom'))
expectTrue ('nom.sg: gen.sg included',          nomSgDistractors.includes('domu'))
expectTrue ('nom.sg: nom.pl included',          nomSgDistractors.includes('domy'))
expectTrue ('nom.sg: no duplicates',            new Set(nomSgDistractors).size === 3)

// ── card not found → empty result ────────────────────────────────────────────
const unknownWord = noun('sx', 'nieznane', 'nieznanego', 'genitive', 'singular')
const emptyResult = getDistractors(unknownWord, 'genitive', cards, 3)
expectTrue ('missing card → []',                emptyResult.length === 0)

// ── adjective → empty (v2 stub) ──────────────────────────────────────────────
const correctAdj = adj('ca', 'uroczy', 'uroczy', 'masculine')
const adjDistractors = getDistractors(correctAdj, 'nominative', cards, 3)
expectTrue ('adj: returns [] (v2 stub)',         adjDistractors.length === 0)

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(44)}`)
console.log(`${passed + failed} tests   ✓ ${passed} passed   ${failed > 0 ? `✗ ${failed} failed` : ''}`)
console.log('─'.repeat(44))
if (failed > 0) process.exit(1)
