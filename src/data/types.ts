export type WordType = 'verb' | 'noun' | 'adjective' | 'unknown'

export type PageId =
  | 'folder'
  | 'translate'
  | 'dynamic_feed'
  | 'question_mark'
  | 'spatial_audio'
  | 'add_page'
  | 'api_config'

export interface PageConfig {
  title: string
  icon: string
  desc: string
  gradient: string
}

// ─── Vocab entry sub-shapes ────────────────────────────────────────────────

export interface VerbConjugations {
  present: string[]
  past: string[]
  past2: string[]
}

export interface NounDeclensions {
  cases: string[]
  singular: string[]
  plural: string[]
}

// ─── Discriminated union for VocabEntry ────────────────────────────────────

interface VocabBase {
  id: string        // lemma — dedup key for localStorage
  enriched: boolean // false until enrich-card populates grammar tables
  pl: string
  en: string
  left: string
  right: string
  tags: WordType[]
}

export interface VocabVerb extends VocabBase {
  type: 'verb'
  conjugations: VerbConjugations | null
  otherForm: { label: string; word: string } | null
}

export interface VocabNoun extends VocabBase {
  type: 'noun'
  gender: string
  plAlt: string
  declensions: NounDeclensions | null
}

export interface AdjectiveDeclensions {
  cases: string[]
  masculine: string[]
  feminine: string[]
  neuter: string[]
  pluralMasc: string[]
  pluralNonMasc: string[]
}

export interface VocabAdjective extends VocabBase {
  type: 'adjective'
  declensions: AdjectiveDeclensions | null
}

export interface VocabUnknown extends VocabBase {
  type: 'unknown'
  info?: string
}

export type VocabEntry = VocabVerb | VocabNoun | VocabAdjective | VocabUnknown
