import { useState, useRef } from 'react'
import { flushSync } from 'react-dom'
import AppBackground from './components/AppBackground'
import PageGradient from './components/PageGradient'
import GlassCanvas from './webgl/GlassCanvas'
import { getGlassMode, setGlassMode, isChromium } from './lib/glassMode'
import TopHeader from './components/TopHeader'
import BottomNav from './components/nav/BottomNav'
import VocabListPage from './components/VocabListPage'
import AddVocabPage from './components/AddVocabPage'
import ApiConfigPage from './components/ApiConfigPage'
import TranslatePage from './components/TranslatePage'
import FlashcardPage from './components/FlashcardPage'
import AudioPlaybackPage from './components/AudioPlaybackPage'
import QuizPage from './components/QuizPage'
import WordDetailModal from './components/WordDetailModal'
import GlassLabPage from './components/GlassLabPage'
import DebugHud from './components/DebugHud'
import { pages } from './data/pages'
import type { PageId, VocabEntry } from './data/types'
import { getCards, saveCard, updateCard, deleteCard } from './lib/storage'
import { vocabularyData } from './data/vocabulary'

export default function App() {
  const [activeId, setActiveId] = useState<PageId>('folder')

  // Glass renderer: 'svg' (Chromium), 'webgl' (Safari/Firefox) or 'css'
  // fallback. If WebGL fails to init or its context is lost — some mobile
  // GPUs choke on the shader (e.g. limited fragment uniform budget) even
  // though canvas.getContext('webgl2') itself succeeds — prefer 'svg' on
  // Chromium (still real glass, just the SVG filter path) over dropping
  // all the way to flat css blur.
  const [glassMode, setGlassModeState] = useState(getGlassMode)
  function handleGlassFallback() {
    const next = isChromium() ? 'svg' : 'css'
    setGlassMode(next)
    setGlassModeState(next)
  }

  // Hide header on scroll down, reveal on scroll up
  const [headerHidden, setHeaderHidden] = useState(false)
  const lastScrollY = useRef(0)

  const [cards, setCards] = useState<VocabEntry[]>(() => {
    const stored = getCards()
    if (stored.length === 0) {
      vocabularyData.forEach(c => saveCard(c))
      return vocabularyData
    }
    // One-time backfill: write aspect to `left` for enriched verb cards that predate this field
    let patched = false
    stored.forEach(c => {
      if (c.type === 'verb' && !c.left && c.enriched && c.otherForm?.label) {
        const label = c.otherForm.label.toLowerCase()
        const aspect = (label.startsWith('pf') && !label.startsWith('impf')) ? 'impf'
                     : label.startsWith('impf') ? 'pf'
                     : ''
        if (aspect) { updateCard(c.id, { left: aspect }); patched = true }
      }
    })
    return patched ? getCards() : stored
  })

  function handleAddCard(entry: VocabEntry) {
    saveCard(entry)
    setCards(getCards())
  }

  function handleEnriched(updated: VocabEntry) {
    updateCard(updated.id, updated)
    setCards(getCards())
    setModalEntry(updated)
  }

  function handleDeleteCard() {
    if (!modalEntry) return
    deleteCard(modalEntry.id)
    setCards(getCards())
    handleCloseModal()
  }

  // ─── Modal animation state ───────────────────────────────────────────────
  const [modalEntry,    setModalEntry]    = useState<VocabEntry | null>(null)
  const [overlayMounted, setOverlayMounted] = useState(false)
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [contentFlipIn,  setContentFlipIn]  = useState(false)
  // True only during the "steady state" fully-open modal — not during either
  // transition. See the background-hiding comment below for why this exists.
  const [backgroundHidden, setBackgroundHidden] = useState(false)
  const activeCardElRef = useRef<HTMLDivElement | null>(null)

  function handleOpenModal(entry: VocabEntry, cardEl: HTMLDivElement | null) {
    activeCardElRef.current = cardEl
    setModalEntry(entry)

    // 1. Flip card out immediately
    cardEl?.classList.add('flip-out')

    // 2. After card starts turning: mount overlay (opacity-0), then fade it in
    //    and spring the modal content in from below the fold
    setTimeout(() => {
      // flushSync commits the mount synchronously so the DOM has opacity-0
      // before we trigger the opacity-1 transition in the next frame
      flushSync(() => setOverlayMounted(true))
      requestAnimationFrame(() => {
        setOverlayVisible(true)
        setContentFlipIn(true)
      })
      // Hide the background only once the backdrop's own fade-in (duration-300)
      // has visually finished — hiding any earlier would pop the background
      // out abruptly mid-fade instead of dimming smoothly alongside it.
      setTimeout(() => setBackgroundHidden(true), 300)
    }, 250)
  }

  function handleCloseModal() {
    // Restore the background immediately so its own card can visibly flip
    // back in over the next 300-600ms — it must not be display:none for that.
    setBackgroundHidden(false)
    // 1. Flip modal content back out
    setContentFlipIn(false)

    // 2. After content flips out: fade overlay and spring card back in
    setTimeout(() => {
      setOverlayVisible(false)
      activeCardElRef.current?.classList.remove('flip-out')

      // 3. After fade completes: unmount overlay
      setTimeout(() => {
        setOverlayMounted(false)
        setModalEntry(null)
      }, 300)
    }, 300)
  }

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const y = e.currentTarget.scrollTop
    if (y <= 50) { setHeaderHidden(false); lastScrollY.current = y; return }
    const delta = y - lastScrollY.current
    if (delta > 4) setHeaderHidden(true)
    else if (delta < -4) setHeaderHidden(false)
    lastScrollY.current = y
  }

  // ─── Page routing ────────────────────────────────────────────────────────
  function changePage(id: PageId) {
    if (id === activeId) return
    setHeaderHidden(false)
    lastScrollY.current = 0
    if ('startViewTransition' in document) {
      document.startViewTransition(() => {
        flushSync(() => setActiveId(id))
      })
    } else {
      setActiveId(id)
    }
  }

  const showNav = activeId !== 'add_page' && activeId !== 'api_config'
  const page = pages[activeId]

  function renderContent() {
    // Glass shader test bench (dev tool) — open with ?lab
    if (new URLSearchParams(window.location.search).has('lab')) return <GlassLabPage />
    if (activeId === 'folder')       return <VocabListPage cards={cards} onOpenModal={handleOpenModal} />
    if (activeId === 'translate')    return <TranslatePage onAddCard={handleAddCard} />
    if (activeId === 'dynamic_feed') return <FlashcardPage cards={cards} onOpenModal={(entry) => handleOpenModal(entry, null)} />
    if (activeId === 'question_mark') return <QuizPage />
    if (activeId === 'spatial_audio') return <AudioPlaybackPage cards={cards} onOpenModal={(entry) => handleOpenModal(entry, null)} />
    if (activeId === 'add_page')   return <AddVocabPage onAddCard={handleAddCard} onSuccess={() => changePage('folder')} />
    if (activeId === 'api_config') return <ApiConfigPage onSave={() => changePage('folder')} />
    return (
      <div className="animate-fade-in flex h-full flex-col items-center justify-center gap-4 text-center">
        <span className="material-symbols-rounded text-6xl text-[#F8FAFC]/70">{page.icon}</span>
        <h1 className="font-instrument text-[24px] font-semibold text-[#F8FAFC]/70">{page.title}</h1>
        <p className="font-instrument px-8 text-[#F8FAFC]/40">{page.desc}</p>
      </div>
    )
  }

  return (
    <div className="relative h-screen w-full">
      {glassMode === 'webgl' && <GlassCanvas activeId={activeId} onFallback={handleGlassFallback} />}
      <AppBackground />
      <PageGradient activeId={activeId} />

      {/* The modal's own backdrop already covers this entire layer while
          open, so hiding it changes nothing visually — but it's essential:
          the WebGL composite shader picks whichever registered pane has the
          SMALLEST screen area at a given pixel, with no notion of z-index
          or visibility. Panes back here (list cards, filter tags, header
          buttons) stay registered and often have a smaller area than the
          modal's own (necessarily large) card, so without this they'd win
          the pick and the modal would render fragments of hidden background
          content instead of itself — reading as flat, edge-less glass.
          display:none zeroes their getBoundingClientRect(), which the
          renderer's existing size check already excludes from the pane list. */}
      <div className={backgroundHidden ? 'hidden' : ''}>
        <TopHeader activeId={activeId} onChangePage={changePage} onImport={() => setCards(getCards())} hidden={headerHidden} />

        <div
          onScroll={handleScroll}
          className="relative z-30 mx-auto flex h-screen w-full max-w-[426px] flex-col overflow-y-auto px-6 pb-[180px] no-scrollbar"
          style={{ paddingTop: 'calc(94px + env(safe-area-inset-top))' }}
        >
          <div
            className="relative z-30 flex h-full w-full flex-col"
            style={{ viewTransitionName: 'page-content' }}
          >
            {renderContent()}
          </div>
        </div>

        {/* Fade the list into the background as it reaches the bottom nav, so
            it disappears under the nav instead of showing through its
            translucent glass. Must sit above BOTH the content (z-30) and the
            shared WebGL glass canvas (z-0) — a card is mostly glass rendered
            on that canvas, so a DOM-only mask wouldn't hide it — and below
            the nav (z-60). Folder page only (the vocab list). */}
        {activeId === 'folder' && (
          <div
            aria-hidden
            className="pointer-events-none fixed inset-x-0 bottom-0 z-50 h-[170px]"
            style={{ background: 'linear-gradient(to top, #121212 0%, #121212 42%, transparent 100%)' }}
          />
        )}
        {showNav && <BottomNav activeId={activeId} onChangePage={changePage} />}
      </div>

      {/* Modal — mounted only during open/close animation cycle */}
      {overlayMounted && modalEntry && (
        <WordDetailModal
          entry={modalEntry}
          flipIn={contentFlipIn}
          overlayVisible={overlayVisible}
          onClose={handleCloseModal}
          onEnriched={handleEnriched}
          onDelete={handleDeleteCard}
        />
      )}

      {new URLSearchParams(window.location.search).has('debug') && <DebugHud />}
    </div>
  )
}
