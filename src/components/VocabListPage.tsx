import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion'
import SearchBar from './SearchBar'
import FilterTag from './FilterTag'
import VocabCard from './VocabCard'
import GlassPane from './GlassPane'
import type { WordType, VocabEntry } from '../data/types'
import { getAllReviews } from '../lib/reviewStorage'
import { isConquered } from '../lib/scheduler'
import { getLlmConfig } from '../lib/llmConfig'
import { installStarterDeck } from '../lib/starterDeck'
import GlassButton from './GlassButton'
import type { PageId } from '../data/types'

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
  /** Empty state only: send a first-time user to Add or App settings. */
  onChangePage: (id: PageId) => void
  /** Lets App drop the bottom scrim when there are no cards for it to fade. */
  onListEmptyChange?: (empty: boolean) => void
  /** Empty state only: the starter deck writes to storage behind App's state. */
  onCardsChanged?: () => void
}

export default function VocabListPage({ cards, onOpenModal, onChangePage, onListEmptyChange, onCardsChanged }: Props) {
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

  // Read once per render: which of the two first-run steps is actually next.
  const hasLlmKey = !!getLlmConfig()

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

  // The bottom scrim exists to fade scrolling cards behind the nav. With none
  // showing it has nothing to do and only harms: it is fixed and sits above the
  // content, so when the keyboard opens and shrinks the viewport it slides up
  // over the empty state and bleaches the very message the user is reading.
  useEffect(() => {
    onListEmptyChange?.(filtered.length === 0)
    return () => onListEmptyChange?.(false)
  }, [filtered.length, onListEmptyChange])

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
            <p className="-mt-[7px] pl-2 font-instrument text-[13px] ink-tertiary">{countLabel}</p>
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
          cards.length === 0 ? (
            /* First run — action-focused. This is the app's very first screen,
               and the old copy ("No cards match your search.") addressed someone
               who had searched: it described a state a new user isn't in and
               offered nothing to do.
               ONE action, deliberately. The obvious layout offers "add a word"
               AND "set your key" AND "import a backup", but competing calls to
               action leave a first-time user choosing instead of starting. So
               the primary adapts to which step is actually next. Import stays
               plain text — a different person (returning, with a backup), not a
               rival button.

               With no key the primary is the starter deck, not the key. Sending
               someone to a provider's website before they have seen the app is
               the wrong first step, and it isn't even necessary: flashcards, the
               quiz and pronunciation all work with no key at all. The deck gives
               them something to work on, which makes the key an upgrade rather
               than a gate. */
            <motion.div
              key="first-run"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-10 flex flex-col items-center gap-4 px-4 text-center"
            >
              <span className="material-symbols-rounded text-[44px] ink-glyph">book_2</span>
              <h2 className="font-instrument text-[20px] font-semibold text-ink/85">
                Your vocabulary starts here
              </h2>
              <p className="max-w-[300px] font-instrument text-[14px] leading-relaxed ink-tertiary">
                {hasLlmKey
                  ? 'Add a Polish word and Polucz fills in the rest — translation, forms and examples — then schedules it for review.'
                  : 'Begin with two words: dzień dobry, “good day”. Both come fully declined, ready to review, and Polucz will say them out loud — no setup, no key.'}
              </p>
              <GlassButton
                variant="primary"
                onClick={() => {
                  if (hasLlmKey) { onChangePage('add_page'); return }
                  installStarterDeck()
                  onCardsChanged?.()
                }}
                className="mt-1 px-6 py-3 font-instrument text-[15px]"
              >
                {hasLlmKey ? 'Add your first word' : 'Start with dzień dobry'}
              </GlassButton>
              {hasLlmKey ? (
                <button
                  onClick={() => { installStarterDeck(); onCardsChanged?.() }}
                  className="max-w-[300px] font-instrument text-[13px] ink-tertiary underline underline-offset-4"
                >
                  Or start with dzień dobry
                </button>
              ) : (
                <p className="max-w-[300px] font-instrument text-[13px] leading-relaxed ink-tertiary">
                  Adding your own words needs an API key —{' '}
                  <button
                    onClick={() => onChangePage('api_config')}
                    className="underline underline-offset-4"
                  >
                    set one up in App settings
                  </button>.
                </p>
              )}
              <p className="max-w-[300px] font-instrument text-[13px] ink-tertiary">
                Already have a backup? Use Import JSON in the settings menu.
              </p>
            </motion.div>
          ) : (
            /* Cards exist; the current view just excludes them. Name which of
               the two reasons it is and hand back the way out, rather than
               stranding the user in a blank list — the exits (collapsing search,
               tapping the highlighted tag) are both invisible from here. */
            <motion.div
              key="no-match"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6 flex flex-col items-center gap-2.5 px-4 text-center"
            >
              <span className="material-symbols-rounded text-[32px] ink-glyph">
                {searchQuery.trim() ? 'search_off' : 'filter_alt_off'}
              </span>
              <p className="max-w-[300px] font-instrument text-[15px] ink-tertiary">
                {searchQuery.trim()
                  ? `No words match \u201c${searchQuery.trim()}\u201d.`
                  : 'Nothing to show for the types you\u2019ve selected.'}
              </p>
              <GlassButton
                variant="secondary"
                onClick={() => {
                  if (searchQuery.trim()) { setSearchQuery(''); return }
                  setSoloed(null)
                  setActiveFilters(ALL_ON)
                }}
                className="mt-1 px-5 py-2.5 font-instrument text-[14px]"
              >
                {searchQuery.trim() ? 'Clear search' : 'Show all types'}
              </GlassButton>
            </motion.div>
          )
        )}
      </motion.div>

      {/* Clearance so the last card sits above the bottom nav */}
      <div aria-hidden="true" className="h-[120px] shrink-0" />
    </div>
  )
}
