import { useState, useRef } from 'react'
import SearchBar from './SearchBar'
import FilterTag from './FilterTag'
import VocabCard from './VocabCard'
import GlassPane from './GlassPane'
import type { WordType, VocabEntry } from '../data/types'
import { getAllReviews } from '../lib/reviewStorage'
import { isConquered } from '../lib/scheduler'

type FilterKey = 'noun' | 'verb' | 'adjective' | 'mastered'

const FILTER_TAGS: { id: FilterKey; label: string }[] = [
  { id: 'noun',      label: 'Noun'     },
  { id: 'verb',      label: 'Verb'     },
  { id: 'adjective', label: 'Adjective'},
  { id: 'mastered',  label: 'Mastered' },
]

interface Props {
  cards: VocabEntry[]
  onOpenModal: (entry: VocabEntry, cardEl: HTMLDivElement | null) => void
}

export default function VocabListPage({ cards, onOpenModal }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeFilters, setActiveFilters] = useState<Record<FilterKey, boolean>>({
    noun: true, verb: true, adjective: true, mastered: true,
  })
  const cardRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())

  function toggleFilter(id: FilterKey) {
    setActiveFilters(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function toggleSearch() {
    setSearchOpen(open => {
      if (open) setSearchQuery('') // collapsing clears the filter too
      return !open
    })
  }

  const reviews = getAllReviews()
  const masteredIds = new Set(
    cards.filter(c => { const r = reviews[c.id]; return r && isConquered(r) }).map(c => c.id)
  )

  const q = searchQuery.toLowerCase()
  const filtered = cards.filter(v => {
    if ((v.type === 'noun' || v.type === 'verb' || v.type === 'adjective') && !activeFilters[v.type as WordType & FilterKey]) return false
    if (masteredIds.has(v.id) && !activeFilters.mastered) return false
    return !q || v.pl.toLowerCase().includes(q) || v.en.toLowerCase().includes(q)
  })

  return (
    <div className="animate-fade-in flex w-full flex-col gap-[24px]">
      {/* Search + filter glass card */}
      <div className="w-full rounded-[36px] shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_0_0_1px_rgba(255,255,255,0.12)]">
        <div className="relative flex w-full flex-col gap-[16px] rounded-[36px] p-[16px]">
          <GlassPane borderRadius={36} className="absolute inset-0 z-0 rounded-[36px] bg-white/[0.02]" />
          <div className="relative z-10 flex flex-col gap-[14px]">
            {/* Filter tags + collapsed search toggle */}
            <div className="flex items-center justify-between gap-[8px]">
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
              <button
                onClick={toggleSearch}
                aria-label={searchOpen ? 'Close search' : 'Open search'}
                className="relative flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border border-[#F8FAFC]/20 shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all hover:scale-105 active:scale-95"
              >
                <GlassPane borderRadius={19} className="absolute inset-0 z-0 rounded-full bg-[#F8FAFC]/10" />
                <span className="material-symbols-rounded relative z-10 text-[20px] text-[#F8FAFC]/70">
                  {searchOpen ? 'close' : 'search'}
                </span>
              </button>
            </div>

            {/* Expanded search field — below the tag row */}
            {searchOpen && (
              <SearchBar value={searchQuery} onChange={setSearchQuery} autoFocus />
            )}
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
              key={entry.id}
              ref={el => { cardRefs.current.set(entry.id, el) }}
              entry={entry}
              mastered={masteredIds.has(entry.id)}
              onClick={() => onOpenModal(entry, cardRefs.current.get(entry.id) ?? null)}
            />
          ))
        )}
      </div>

      {/* Clearance so the last card sits above the bottom nav */}
      <div aria-hidden="true" className="h-[120px] shrink-0" />
    </div>
  )
}
