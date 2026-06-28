import type { VocabEntry } from './types'

export const vocabularyData: VocabEntry[] = [
  {
    pl: 'mówić',
    en: 'to speak',
    type: 'verb',
    left: 'impf',
    right: 'impf',
    tags: ['verb'],
    conjugations: {
      present: ['mówię', 'mówisz', 'mówi', 'mówimy', 'mówicie', 'mówią'],
      past:    ['mówiłem', 'mówiłeś', 'mówił', 'mówiliśmy', 'mówiliście', 'mówili'],
      past2:   ['mówiłam', 'mówiłaś', 'mówiła', 'mówiłyśmy', 'mówiłyście', 'mówiły'],
    },
    otherForm: { label: 'pf form', word: 'powiedzieć' },
  },
  {
    pl: 'książka',
    en: 'book',
    type: 'noun',
    left: 'nom',
    right: 'f',
    tags: ['noun'],
    gender: 'f.',
    plAlt: 'książki',
    declensions: {
      cases:    ['mianownik', 'dopełniacz', 'celownik', 'biernik', 'narzędnik', 'miejscownik', 'wołacz'],
      singular: ['książka', 'książki', 'książce', 'książkę', 'książką', 'książce', 'książko'],
      plural:   ['książki', 'książek', 'książkom', 'książki', 'książkami', 'książkach', 'książki'],
    },
  },
  {
    pl: 'dom',
    en: 'house',
    type: 'noun',
    left: 'nom',
    right: 'm',
    tags: ['noun'],
    gender: 'm.',
    plAlt: 'domy',
    declensions: {
      cases:    ['mianownik', 'dopełniacz', 'celownik', 'biernik', 'narzędnik', 'miejscownik', 'wołacz'],
      singular: ['dom', 'domu', 'domowi', 'dom', 'domem', 'domu', 'domu'],
      plural:   ['domy', 'domów', 'domom', 'domy', 'domami', 'domach', 'domy'],
    },
  },
  {
    pl: 'piękny',
    en: 'beautiful',
    type: 'adjective',
    left: 'nom',
    right: 'm',
    tags: ['adjective'],
    info: 'Used for describing appearances.',
  },
]
