#!/usr/bin/env node
/**
 * Spell-checks every form in the bundled starter deck.
 *
 * The deck ships as fact: a new user meets it before they have any way to judge
 * whether the Polish is right, so a wrong form there is worse than a wrong form
 * on a card they added themselves. This runs every paradigm through the
 * Hunspell Polish dictionary (dictionary-pl, a devDependency — none of it is
 * bundled into the app).
 *
 * What it catches: malformed forms, of the kind LLM enrichment has produced
 *   (*dzieckem for dzieckiem, *wyść for wyjść).
 * What it cannot catch: a real Polish word sitting in the wrong slot. Only a
 *   speaker or a part-of-speech tagger can see that.
 *
 * Usage:  npm run check:deck        (exits non-zero on a miss)
 */
import nspell from 'nspell'
import dictionary from 'dictionary-pl'
import { readFileSync } from 'fs'

const spell = nspell(dictionary)
const cards = JSON.parse(readFileSync('src/data/starterDeck.json', 'utf8'))

let checked = 0
const bad = []
// Alternatives are written "dobrego/dobry" in a single cell; check each side.
const check = (word, where) => {
  for (const w of String(word).split('/')) {
    const t = w.trim()
    if (!t) continue
    checked++
    if (!spell.correct(t)) bad.push({ word: t, where })
  }
}

for (const c of cards) {
  check(c.id, `${c.id} lemma`)
  if (c.type === 'noun') {
    c.declensions.singular.forEach((w, i) => check(w, `${c.id} sg[${i}]`))
    c.declensions.plural.forEach((w, i) => check(w, `${c.id} pl[${i}]`))
  }
  if (c.type === 'verb') {
    for (const k of ['present', 'past', 'past2']) {
      c.conjugations[k].forEach((w, i) => check(w, `${c.id} ${k}[${i}]`))
    }
    if (c.otherForm) check(c.otherForm.word, `${c.id} pf`)
  }
  if (c.type === 'adjective') {
    for (const k of ['masculine', 'feminine', 'neuter', 'pluralMasc', 'pluralNonMasc']) {
      c.declensions[k].forEach((w, i) => check(w, `${c.id} ${k}[${i}]`))
    }
    check(c.comparative, `${c.id} comparative`)
    check(c.superlative, `${c.id} superlative`)
  }
}

console.log(`checked ${checked} forms across ${cards.length} cards`)
console.log(`unrecognised: ${bad.length}`)
for (const b of bad) console.log(`  ${b.word.padEnd(18)} ${b.where}`)
if (bad.length > 0) process.exit(1)
