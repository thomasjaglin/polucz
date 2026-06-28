import { useState } from 'react'
import LiquidGlassFilter from './components/LiquidGlassFilter'
import AppBackground from './components/AppBackground'
import PageGradient from './components/PageGradient'
import TopHeader from './components/TopHeader'
import BottomNav from './components/nav/BottomNav'
import VocabListPage from './components/VocabListPage'
import { pages } from './data/pages'
import type { PageId, VocabEntry } from './data/types'

export default function App() {
  const [activeId, setActiveId] = useState<PageId>('folder')

  function changePage(id: PageId) {
    if (id === activeId) return
    setActiveId(id)
  }

  function handleOpenModal(_entry: VocabEntry, _cardEl: HTMLDivElement | null) {
    // Phase 7: wire modal open
  }

  const showNav = activeId !== 'add_page' && activeId !== 'api_config'
  const page = pages[activeId]

  function renderContent() {
    if (activeId === 'folder') {
      return <VocabListPage onOpenModal={handleOpenModal} />
    }
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
      <LiquidGlassFilter />
      <AppBackground />
      <PageGradient activeId={activeId} />

      <TopHeader activeId={activeId} onChangePage={changePage} />

      <div className="relative z-30 mx-auto flex h-screen w-full max-w-[426px] flex-col overflow-y-auto px-6 pt-[82px] pb-[120px] no-scrollbar">
        <div
          className="relative z-30 flex h-full w-full flex-col"
          style={{ viewTransitionName: 'page-content' }}
        >
          {renderContent()}
        </div>
      </div>

      {showNav && <BottomNav activeId={activeId} onChangePage={changePage} />}
    </div>
  )
}
