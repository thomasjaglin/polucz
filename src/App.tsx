import { useState, useRef, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { MotionConfig } from 'framer-motion'
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
import Toaster from './components/Toaster'
import { pushToast } from './lib/toastStore'
import { pages, pageOrder } from './data/pages'
import type { PageId, VocabEntry } from './data/types'
import { getCards, saveCard, updateCard, deleteCard } from './lib/storage'
import { installStarterDeck } from './lib/starterDeck'
import { useTour } from './components/tour/useTour'
import Spotlight from './components/tour/Spotlight'
import FirstRunGate from './components/tour/FirstRunGate'
import { tourStatus, finishTour } from './lib/tourState'
import { haptics } from './lib/haptics'
import { getAllReviews } from './lib/reviewStorage'
import { isConquered } from './lib/scheduler'
import { initHoloMotion } from './lib/holoMotion'
import { initScrollGlass } from './lib/scrollGlass'
import { initBackHandler } from './lib/backStack'
import { useBackClose } from './hooks/useBackClose'

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
  const [listEmpty, setListEmpty] = useState(false)
  const lastScrollY = useRef(0)
  const lastTickY = useRef(0)   // last scroll position that fired a haptic tick

  const [cards, setCards] = useState<VocabEntry[]>(() => {
    const stored = getCards()
    // No seeding. A fresh install used to get four demo words written straight
    // into storage, which made the app look alive but left a new user unable to
    // tell the samples from their own words — and made the empty state
    // unreachable. An empty list now stays empty, and VocabListPage says what to
    // do about it.
    if (stored.length === 0) return []
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
    pushToast(`${entry.pl} added to vocabulary`, 'success')
  }

  function handleEnriched(updated: VocabEntry) {
    updateCard(updated.id, updated)
    setCards(getCards())
    setModalEntry(updated)
  }

  // The modal cached this card's TTS audio → mark it audio-ready (partial merge,
  // so it doesn't clobber enrichment). Drives the list "ready" icon and gates
  // which cards the audio player will use.
  function handleAudioReady(id: string) {
    updateCard(id, { audioReady: true })
    setCards(getCards())
    setModalEntry(e => (e && e.id === id ? { ...e, audioReady: true } : e))
  }

  function handleDeleteCard() {
    if (!modalEntry) return
    const removed = modalEntry.pl
    deleteCard(modalEntry.id)
    setCards(getCards())
    handleCloseModal()
    pushToast(`${removed} deleted`, 'delete')
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

  // Android hardware-back handling (see backStack.ts). Install once, then let
  // each overlay register itself so back closes it instead of exiting the app.
  useEffect(() => { initBackHandler() }, [])
  useEffect(() => { initHoloMotion() }, [])
  useEffect(() => { initScrollGlass() }, [])
  useBackClose(!!modalEntry, handleCloseModal)
  // Android back on any non-home tab returns to the vocab list. Each page's own
  // sub-screen back (quiz session→selector, audio playback→start) registers on
  // top of this, so those pop first before this exits the tab.
  useBackClose(activeId !== 'folder', () => changePage('folder'))

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
    // Ratchet: a tiny haptic tick every ~48px of scroll (Android only).
    if (Math.abs(y - lastTickY.current) >= 48) {
      haptics.scrollTick()
      lastTickY.current = y
    }
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
    // Give the page-content view transition a direction: horizontal slide that
    // matches the swipe/nav order when both pages sit in pageOrder, else fall
    // back to the default vertical slide (add/api pages, non-adjacent jumps).
    const from = pageOrder.indexOf(activeId)
    const to = pageOrder.indexOf(id)
    if (from !== -1 && to !== -1) {
      document.documentElement.dataset.pageDir = to > from ? 'forward' : 'back'
    } else {
      delete document.documentElement.dataset.pageDir
    }
    if ('startViewTransition' in document) {
      document.startViewTransition(() => {
        flushSync(() => setActiveId(id))
      })
    } else {
      setActiveId(id)
    }
  }

  // ─── Edge-swipe page navigation ──────────────────────────────────────────
  // A single-finger swipe that STARTS within SWIPE_EDGE px of the left/right
  // screen edge navigates through pageOrder — that zone sits in the page
  // margins, so it never collides with the center-screen card drags
  // (flashcard/translate), vertical scroll, taps, or the two-finger rotation
  // gesture (cancelled below). Swipe left → next page, right → previous.
  const SWIPE_EDGE = 30, SWIPE_MIN_X = 70, SWIPE_MAX_Y = 50
  const swipeStart = useRef<{ x: number; y: number } | null>(null)

  function handleTouchStart(e: React.TouchEvent) {
    // Not while a modal is open, and single-touch only (protects two-finger gestures).
    if (overlayMounted || e.touches.length !== 1) { swipeStart.current = null; return }
    const t = e.touches[0]
    const nearEdge = t.clientX <= SWIPE_EDGE || t.clientX >= window.innerWidth - SWIPE_EDGE
    swipeStart.current = nearEdge ? { x: t.clientX, y: t.clientY } : null
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (e.touches.length > 1) swipeStart.current = null // a second finger → not a page swipe
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const s = swipeStart.current
    swipeStart.current = null
    if (!s || e.changedTouches.length !== 1) return
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (Math.abs(dx) < SWIPE_MIN_X || Math.abs(dy) > SWIPE_MAX_Y) return
    const idx = pageOrder.indexOf(activeId)
    if (idx === -1) return // add/api pages aren't in the swipe flow
    const next = idx + (dx < 0 ? 1 : -1)
    if (next >= 0 && next < pageOrder.length) { haptics.select(); changePage(pageOrder[next]) }
  }

  // Every empty state that offers the welcome words routes through here, so the
  // vocabulary list, the flashcard deck and the quiz all agree immediately
  // afterwards no matter which page the user was standing on.
  const tour = useTour()

  // The gate is the first thing a genuinely new install sees: no cards, and the
  // arrival tour never offered. It is asked once — skipping is remembered.
  const [gateOpen, setGateOpen] = useState(
    () => getCards().length === 0 && tourStatus('arrival') === 'unseen',
  )

  const handleWelcome = () => { installStarterDeck(); setCards(getCards()) }

  const showNav = activeId !== 'add_page' && activeId !== 'api_config'
  const page = pages[activeId]
  // Top padding is sized to whatever TopHeader actually draws on this page, so
  // no page reserves space for a header it doesn't have:
  //   main nav  — centered logo row, needs the full 94px clearance
  //   compact   — flashcard / quiz / audio draw their own headings: gutter only
  //   secondary — add / settings show a lone back button at 1rem + 42px tall,
  //               so 58px puts content directly beneath it
  const compactTop = activeId === 'dynamic_feed' || activeId === 'question_mark' || activeId === 'spatial_audio'
  const secondaryTop = activeId === 'add_page' || activeId === 'api_config'
  const topPad = compactTop ? '1.25rem' : secondaryTop ? '58px' : '94px'

  function renderContent() {
    if (activeId === 'folder')       return (
      <VocabListPage
        cards={cards}
        onOpenModal={handleOpenModal}
        onChangePage={changePage}
        onListEmptyChange={setListEmpty}
        onCardsChanged={() => setCards(getCards())}
        onTourEvent={tour.notify}
      />
    )
    if (activeId === 'translate')    return (
      <TranslatePage
        onAddCard={handleAddCard}
        onChangePage={changePage}
        tourActive={tour.id === 'arrival'}
        onTourEvent={e => {
          tour.notify(e)
          // The next step is about the library, so take them there rather than
          // leaving a prompt about cards on top of the translate page.
          if (e === 'words-added') { setCards(getCards()); changePage('folder') }
        }}
      />
    )
    if (activeId === 'dynamic_feed') return <FlashcardPage cards={cards} onOpenModal={(entry) => handleOpenModal(entry, null)} onWelcome={handleWelcome} />
    if (activeId === 'question_mark') return <QuizPage onWelcome={handleWelcome} />
    if (activeId === 'spatial_audio') return <AudioPlaybackPage cards={cards} onOpenModal={(entry) => handleOpenModal(entry, null)} onWelcome={handleWelcome} />
    if (activeId === 'add_page')   return <AddVocabPage onAddCard={handleAddCard} onSuccess={() => changePage('folder')} />
    if (activeId === 'api_config') return <ApiConfigPage onSave={() => { setCards(getCards()); changePage('folder') }} />
    return (
      <div className="animate-fade-in flex h-full flex-col items-center justify-center gap-4 text-center">
        <span className="material-symbols-rounded text-6xl text-ink/70">{page.icon}</span>
        <h1 className="font-instrument text-[24px] font-semibold text-ink/70">{page.title}</h1>
        <p className="font-instrument px-8 ink-tertiary">{page.desc}</p>
      </div>
    )
  }

  return (
    // Motion is opt-out for anyone whose system asks for reduced motion. Doing
    // it here rather than per component means a new <motion.*> inherits the
    // behaviour instead of having to remember it: "user" keeps opacity fades and
    // drops the transforms, which is the distinction the preference is actually
    // about. Components that need finer control still call useReducedMotion —
    // VocabListPage collapses its stagger and its height animation that way.
    <MotionConfig reducedMotion="user">
    <div
      className="relative h-screen w-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
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
        <TopHeader activeId={activeId} onChangePage={changePage} onImport={() => setCards(getCards())} cards={cards} onAudioReady={handleAudioReady} hidden={headerHidden} onPrepOpenChange={setBackgroundHidden} />

        <div
          onScroll={handleScroll}
          className="relative z-30 mx-auto flex h-screen w-full max-w-[426px] flex-col overflow-y-auto px-6 pb-[180px] no-scrollbar"
          style={{ paddingTop: `calc(${topPad} + env(safe-area-inset-top))` }}
        >
          {/* shrink-0 matters: as a flex item of the scroller this wrapper would
              otherwise shrink below its content, the content would spill out of
              it, and the scroller's bottom padding would sit above the spill
              rather than after it — so the last control on a long page ended
              flush with the screen edge (the Save DeepL key button). min-h-full
              rather than h-full so it can also grow past the viewport; short
              pages that centre with h-full or flex-1 measure the same as
              before. */}
          <div
            className="relative z-30 flex min-h-full w-full shrink-0 flex-col"
            style={{ viewTransitionName: 'page-content' }}
          >
            {renderContent()}
          </div>
        </div>

        {/* Bottom scrim: a static gradient behind the floating nav that fades
            the scrolling card list into the page's base colour, so cards don't
            clutter the nav. Sits above the content (z-30) and below the nav
            (z-60). Static (unlike a per-frame mask), so it doesn't jank scroll. */}
        {showNav && !listEmpty && (
          <div
            className="pointer-events-none fixed inset-x-0 bottom-0 z-50 h-[210px]"
            style={{ background: 'var(--nav-scrim)' }}
          />
        )}

        {showNav && <BottomNav activeId={activeId} onChangePage={changePage} />}
      </div>

      {/* Modal — mounted only during open/close animation cycle */}
      {overlayMounted && modalEntry && (
        <WordDetailModal
          entry={modalEntry}
          mastered={(() => { const r = getAllReviews()[modalEntry.id]; return !!r && isConquered(r) })()}
          flipIn={contentFlipIn}
          overlayVisible={overlayVisible}
          onClose={handleCloseModal}
          onEnriched={handleEnriched}
          onAudioReady={handleAudioReady}
          onDelete={handleDeleteCard}
        />
      )}

      {/* Global toast stack (top of screen) */}
      <Toaster activeId={activeId} />

      {gateOpen && (
        <FirstRunGate
          onSetUpKeys={() => { setGateOpen(false); changePage('api_config') }}
          onTakeTour={() => { setGateOpen(false); changePage('translate'); tour.start('arrival') }}
          onSkip={() => { setGateOpen(false); finishTour('arrival', 'skipped') }}
        />
      )}

      {/* Above the modal, so a step can point at something inside it. */}
      {tour.step && (
        <Spotlight
          anchor={tour.step.anchor}
          text={tour.step.text}
          progress={tour.progress}
          nextLabel={tour.step.nextLabel}
          onNext={tour.step.nextLabel ? tour.next : undefined}
          onSkip={tour.skip}
        />
      )}
    </div>
    </MotionConfig>
  )
}
