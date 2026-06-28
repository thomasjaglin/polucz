import { useState, useRef } from 'react'
import SearchBar from './SearchBar'
import FilterTag from './FilterTag'
import VocabCard from './VocabCard'
import GlassPane from './GlassPane'
import { vocabularyData } from '../data/vocabulary'
import type { WordType, VocabEntry } from '../data/types'

const FILTER_TAGS: { id: WordType; label: string }[] = [
  { id: 'noun',      label: 'Noun'      },
  { id: 'verb',      label: 'Verb'      },
  { id: 'adjective', label: 'Adjective' },
  { id: 'unknown',   label: 'Unknown'   },
]

interface Props {
  onOpenModal: (entry: VocabEntry, cardEl: HTMLDivElement | null) => void
}

export default function VocabListPage({ onOpenModal }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilters, setActiveFilters] = useState<Record<WordType, boolean>>({
    noun: true, verb: true, adjective: true, unknown: true,
  })
  const cardRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())

  function toggleFilter(id: WordType) {
    setActiveFilters(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const q = searchQuery.toLowerCase()
  const filtered = vocabularyData.filter(v =>
    activeFilters[v.type] &&
    (v.pl.toLowerCase().includes(q) || v.en.toLowerCase().includes(q))
  )

  return (
    <div className="animate-fade-in flex w-full flex-col gap-[24px]">
      {/* Search + filter glass card */}
      <div className="w-full rounded-[36px] shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_0_0_1px_rgba(255,255,255,0.12)]">
        <div className="relative flex w-full flex-col gap-[16px] rounded-[36px] p-[16px]">
          <GlassPane borderRadius={36} className="absolute inset-0 z-0 rounded-[36px] bg-white/[0.02]" />
          <div className="relative z-10">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
            <div className="flex flex-wrap items-center gap-[8px]">
              {FILTER_TAGS.map(f => (
                <FilterTag
                  key={f.id}
                  id={f.id}
                  label={f.label}
                  active={activeFilters[f.id]}
                  onToggle={() => toggleFilter(f.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Vocab list */}
      <div className="flex flex-col gap-[16px]">
        {filtered.length === 0 ? (
          <p className="mt-8 text-center font-instrument text-[16px] text-[#F8FAFC]/40">
            No cards match your search.
          </p>
        ) : (
          filtered.map(entry => (
            <VocabCard
              key={entry.pl}
              ref={el => { cardRefs.current.set(entry.pl, el) }}
              entry={entry}
              onClick={() => onOpenModal(entry, cardRefs.current.get(entry.pl) ?? null)}
            />
          ))
        )}
      </div>
    </div>
  )
}
