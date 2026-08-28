import { useState, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion'
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
  const reduce = useReducedMotion()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeFilters, setActiveFilters] = useState<Record<FilterKey, boolean>>({
    noun: true, verb: true, adjective: true, mastered: true,
  })
  const cardRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())

  // Which tag, if any, is soloed by a long press — highlighted, and the only
  // one whose cards show. One slot, so there's never a stacked state to reason
  // about. It also carries the "only mastered" filter, which is the one thing
  // the on/off toggles can't express on their own: `mastered: true` means
  // "don't hide them", not "show only them".
  const [soloed, setSoloed] = useState<FilterKey | null>(null)

  const ALL_ON: Record<FilterKey, boolean> = { noun: true, verb: true, adjective: true, mastered: true }

  function toggleFilter(id: FilterKey) {
    // A tap on the highlighted tag is the way out of a solo, and it clears the
    // whole bar rather than just that tag. Leaving the tag to toggle itself off
    // instead would strand a solo'd Mastered on an empty list, since the flag
    // would still hold while its own tag said to hide mastered cards.
    if (soloed === id) {
      setSoloed(null)
      setActiveFilters(ALL_ON)
      return
    }
    // Touching any other tag ends the solo too — it is no longer the only
    // thing showing, so it must stop claiming to be.
    if (soloed !== null) setSoloed(null)
    setActiveFilters(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function soloFilter(id: FilterKey) {
    // Long-pressing what's already soloed is the same exit as tapping it, so
    // the highlighted tag always returns you to everything, however it's pressed.
    if (soloed === id) {
      setSoloed(null)
      setActiveFilters(ALL_ON)
      return
    }
    setSoloed(id)
    // Mastered cuts across the types, so its solo shows every mastered card and
    // resets the type toggles rather than carrying a stale selection in. A type
    // solo only speaks for the types, and leaves Mastered as it found it.
    setActiveFilters(prev => id === 'mastered' ? ALL_ON : {
      noun: id === 'noun',
      verb: id === 'verb',
      adjective: id === 'adjective',
      mastered: prev.mastered,
    })
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
  const filtered = [...cards].reverse().filter(v => {
    if (soloed === 'mastered' && !masteredIds.has(v.id)) return false
    if ((v.type === 'noun' || v.type === 'verb' || v.type === 'adjective') && !activeFilters[v.type as WordType & FilterKey]) return false
    if (masteredIds.has(v.id) && !activeFilters.mastered) return false
    return !q || v.pl.toLowerCase().includes(q) || v.en.toLowerCase().includes(q)
  })

  // Count line under the filters: total normally, "X out of Y" while filtered.
  const wordNoun = (n: number) => (n === 1 ? 'word' : 'words')
  const countLabel = filtered.length === cards.length
    ? `${cards.length} ${wordNoun(cards.length)}`
    : `${filtered.length} ${wordNoun(filtered.length)} out of ${cards.length}`

  // List motion: cards cascade in on mount/filter (staggerChildren), fade+scale
  // out when filtered away, and the `layout` prop glides the survivors up to
  // close the gap. Reduced motion collapses to an instant opacity-only swap.
  const listContainer: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: reduce ? 0 : 0.04 } },
  }
  const listItem: Variants = reduce
    ? { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0 } }, exit: { opacity: 0, transition: { duration: 0 } } }
    : {
        hidden: { opacity: 0, y: 12 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.33, 1, 0.68, 1] } },
        exit: { opacity: 0, scale: 0.96, transition: { duration: 0.15, ease: 'easeIn' } },
      }

  return (
    <div className="animate-fade-in flex w-full flex-col gap-6">
      {/* Search + filter glass card */}
      <div className="w-full rounded-[36px] glass-raise">
        <div className="relative flex w-full flex-col gap-4 rounded-[36px] p-4">
          <GlassPane forceCss borderRadius={36} className="absolute inset-0 z-0 rounded-[36px] bg-ink/[0.02]" />
          <div className="relative z-10 flex flex-col gap-3.5">
            {/* Filter tags + collapsed search toggle */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {FILTER_TAGS.map(f => (
                  <FilterTag
                    key={f.id}
                    id={f.id}
                    label={f.label}
                    active={activeFilters[f.id]}
                    soloed={soloed === f.id}
                    onToggle={() => toggleFilter(f.id)}
                    onLongPress={() => soloFilter(f.id)}
                  />
                ))}
              </div>
              <button
                onClick={toggleSearch}
                aria-label={searchOpen ? 'Close search' : 'Open search'}
                className="relative flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border border-ink/20 shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all hover:scale-105 active:scale-95"
              >
                <GlassPane forceCss borderRadius={20} className="absolute inset-0 z-0 rounded-full bg-ink/10" />
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={searchOpen ? 'close' : 'search'}
                    initial={reduce ? false : { rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={reduce ? { opacity: 0 } : { rotate: 90, opacity: 0 }}
                    transition={{ duration: reduce ? 0 : 0.18, ease: 'easeOut' }}
                    className="material-symbols-rounded relative z-10 text-[20px] text-ink/70"
                  >
                    {searchOpen ? 'close' : 'search'}
                  </motion.span>
                </AnimatePresence>
              </button>
            </div>

            {/* Expanded search field — unfolds below the tag row (height + fade)
                instead of snapping in and shoving the count label. */}
            <AnimatePresence initial={false}>
              {searchOpen && (
                <motion.div
                  key="search"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={reduce
                    ? { duration: 0 }
                    : { height: { duration: 0.28, ease: [0.33, 1, 0.68, 1] }, opacity: { duration: 0.2, ease: 'easeOut' } }}
                  style={{ overflow: 'hidden' }}
                >
                  <SearchBar value={searchQuery} onChange={setSearchQuery} autoFocus />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Total / filtered card count */}
            <p className="-mt-[7px] pl-2 font-instrument text-[13px] text-ink/55">{countLabel}</p>
          </div>
        </div>
      </div>

      {/* Vocab list */}
      <motion.div className="flex flex-col gap-4" variants={listContainer} initial="hidden" animate="visible">
        <AnimatePresence mode="popLayout">
          {filtered.map(entry => (
            <motion.div
              key={entry.id}
              layout
              variants={listItem}
              exit="exit"
              className="card-cv w-full"
            >
              <VocabCard
                ref={el => { cardRefs.current.set(entry.id, el) }}
                entry={entry}
                mastered={masteredIds.has(entry.id)}
                onClick={() => onOpenModal(entry, cardRefs.current.get(entry.id) ?? null)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        {filtered.length === 0 && (
          <motion.p
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 text-center font-instrument text-[16px] text-ink/40"
          >
            No cards match your search.
          </motion.p>
        )}
      </motion.div>

      {/* Clearance so the last card sits above the bottom nav */}
      <div aria-hidden="true" className="h-[120px] shrink-0" />
    </div>
  )
}
