import { useState, useEffect, useRef } from 'react'
import IconButton from './IconButton'
import AppLogo from './AppLogo'
import type { PageId } from '../data/types'

interface Props {
  activeId: PageId
  onChangePage: (id: PageId) => void
}

export default function TopHeader({ activeId, onChangePage }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const settingsBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!settingsOpen) return
    function handleOutsideClick(e: MouseEvent) {
      if (
        dropdownRef.current?.contains(e.target as Node) ||
        settingsBtnRef.current?.contains(e.target as Node)
      ) return
      setSettingsOpen(false)
    }
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [settingsOpen])

  // Secondary pages: back button only, no logo
  if (activeId === 'add_page' || activeId === 'api_config') {
    return (
      <div className="absolute left-6 top-4 z-50 flex items-center gap-[12px]">
        <IconButton icon="arrow_back" onClick={() => onChangePage('folder')} />
      </div>
    )
  }

  // Main nav pages: logo centered + optional right-side actions
  return (
    <div className="absolute inset-x-0 top-4 z-50 mx-auto flex max-w-[426px] items-center justify-center px-6">
      {/* Logo — centered */}
      <AppLogo />

      {/* Folder-only: add + settings buttons on the right */}
      {activeId === 'folder' && (
        <div className="absolute right-6 flex items-center gap-[12px]">
          <IconButton icon="add" onClick={() => onChangePage('add_page')} />
          <div className="relative">
            <IconButton
              ref={settingsBtnRef}
              icon="settings"
              onClick={() => setSettingsOpen(prev => !prev)}
            />
            {settingsOpen && (
              <div
                ref={dropdownRef}
                className="absolute right-0 top-[50px] z-[100] flex w-[200px] flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#1a1a1a]/95 shadow-2xl backdrop-blur-3xl"
              >
                <button
                  onClick={() => { alert('Import JSON'); setSettingsOpen(false) }}
                  className="flex w-full items-center gap-3 border-b border-white/5 px-5 py-3.5 text-left font-instrument text-[15px] font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <span className="material-symbols-rounded text-[18px]">download</span>
                  Import JSON
                </button>
                <button
                  onClick={() => { alert('Export JSON'); setSettingsOpen(false) }}
                  className="flex w-full items-center gap-3 border-b border-white/5 px-5 py-3.5 text-left font-instrument text-[15px] font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <span className="material-symbols-rounded text-[18px]">upload</span>
                  Export JSON
                </button>
                <button
                  onClick={() => { onChangePage('api_config'); setSettingsOpen(false) }}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left font-instrument text-[15px] font-medium text-[#B4A0FF] transition-colors hover:bg-[#B4A0FF]/10 hover:text-[#c4b5fd]"
                >
                  <span className="material-symbols-rounded text-[18px]">api</span>
                  API config
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
