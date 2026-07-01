import { useState, useRef } from 'react'
import { flushSync } from 'react-dom'
import AppBackground from './components/AppBackground'
import PageGradient from './components/PageGradient'
import TopHeader from './components/TopHeader'
import BottomNav from './components/nav/BottomNav'
import VocabListPage from './components/VocabListPage'
import AddVocabPage from './components/AddVocabPage'
import ApiConfigPage from './components/ApiConfigPage'
import TranslatePage from './components/TranslatePage'
import FlashcardPage from './components/FlashcardPage'
import AudioPlaybackPage from './components/AudioPlaybackPage'
import WordDetailModal from './components/WordDetailModal'
import { pages } from './data/pages'
import type { PageId, VocabEntry } from './data/types'
import { getCards, saveCard, updateCard } from './lib/storage'
import { vocabularyData } from './data/vocabulary'

export default function App() {
  const [activeId, setActiveId] = useState<PageId>('folder')

  const [cards, setCards] = useState<VocabEntry[]>(() => {
    const stored = getCards()
    if (stored.length === 0) {
      vocabularyData.forEach(c => saveCard(c))
      return vocabularyData
    }
    return stored
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

  // ─── Modal animation state ───────────────────────────────────────────────
  const [modalEntry,    setModalEntry]    = useState<VocabEntry | null>(null)
  const [overlayMounted, setOverlayMounted] = useState(false)
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [contentFlipIn,  setContentFlipIn]  = useState(false)
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
    }, 250)
  }

  function handleCloseModal() {
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

  // ─── Page routing ────────────────────────────────────────────────────────
  function changePage(id: PageId) {
    if (id === activeId) return
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
    if (activeId === 'folder')     return <VocabListPage cards={cards} onOpenModal={handleOpenModal} />
    if (activeId === 'translate')   return <TranslatePage onAddCard={handleAddCard} />
    if (activeId === 'dynamic_feed')  return <FlashcardPage cards={cards} />
    if (activeId === 'spatial_audio') return <AudioPlaybackPage cards={cards} />
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
      <AppBackground />
      <PageGradient activeId={activeId} />

      <TopHeader activeId={activeId} onChangePage={changePage} />

      <div className={`relative z-30 mx-auto flex h-screen w-full max-w-[426px] flex-col px-6 pb-[120px] pt-[82px] no-scrollbar ${overlayMounted ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        <div
          className="relative z-30 flex h-full w-full flex-col"
          style={{ viewTransitionName: 'page-content' }}
        >
          {renderContent()}
        </div>
      </div>

      {showNav && <BottomNav activeId={activeId} onChangePage={changePage} />}

      {/* Modal — mounted only during open/close animation cycle */}
      {overlayMounted && modalEntry && (
        <WordDetailModal
          entry={modalEntry}
          flipIn={contentFlipIn}
          overlayVisible={overlayVisible}
          onClose={handleCloseModal}
          onEnriched={handleEnriched}
        />
      )}
    </div>
  )
}
