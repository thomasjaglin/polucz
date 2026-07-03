import { useState, useEffect, useRef } from 'react'
import IconButton from './IconButton'
import AppLogo from './AppLogo'
import type { PageId } from '../data/types'
import { getCards, replaceAllCards } from '../lib/storage'
import { getAllReviews, replaceAllReviews } from '../lib/reviewStorage'
import { saveSentences } from '../lib/sentenceStorage'

interface Props {
  activeId: PageId
  onChangePage: (id: PageId) => void
  onImport: () => void
  hidden?: boolean
}

export default function TopHeader({ activeId, onChangePage, onImport, hidden = false }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const settingsBtnRef = useRef<HTMLButtonElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  function buildPayload() {
    return { version: 1, cards: getCards(), reviews: getAllReviews() }
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(buildPayload(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `polucz-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setSettingsOpen(false)
  }

  const [copyLabel, setCopyLabel] = useState<'idle' | 'copied' | 'error'>('idle')

  async function handleCopyToClipboard() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(buildPayload(), null, 2))
      setCopyLabel('copied')
      setTimeout(() => setCopyLabel('idle'), 2000)
    } catch {
      setCopyLabel('error')
      setTimeout(() => setCopyLabel('idle'), 2000)
    }
    setSettingsOpen(false)
  }

  function handleImportClick() {
    fileInputRef.current?.click()
    setSettingsOpen(false)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        if (!Array.isArray(data.cards) || typeof data.reviews !== 'object') {
          alert('Invalid backup file.')
          return
        }
        replaceAllCards(data.cards)
        replaceAllReviews(data.reviews)
        if (Array.isArray(data.sentences) && data.sentences.length > 0) {
          saveSentences(data.sentences)
        }
        onImport()
      } catch {
        alert('Could not read the file. Make sure it is a valid Polucz backup.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

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
    <div className={`absolute inset-x-0 top-0 z-50 transition-transform duration-300 ease-in-out ${hidden ? '-translate-y-full' : 'translate-y-0'}`}>
    <div className="relative mx-auto flex max-w-[426px] items-center justify-center px-6 pt-4">
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
                  onClick={handleImportClick}
                  className="flex w-full items-center gap-3 border-b border-white/5 px-5 py-3.5 text-left font-instrument text-[15px] font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <span className="material-symbols-rounded text-[18px]">download</span>
                  Import JSON
                </button>
                <button
                  onClick={handleExport}
                  className="flex w-full items-center gap-3 border-b border-white/5 px-5 py-3.5 text-left font-instrument text-[15px] font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <span className="material-symbols-rounded text-[18px]">upload</span>
                  Export JSON
                </button>
                <button
                  onClick={handleCopyToClipboard}
                  className="flex w-full items-center gap-3 border-b border-white/5 px-5 py-3.5 text-left font-instrument text-[15px] font-medium transition-colors hover:bg-white/10"
                  style={{ color: copyLabel === 'copied' ? '#86efac' : copyLabel === 'error' ? '#f87171' : 'rgba(248,250,252,0.5)' }}
                >
                  <span className="material-symbols-rounded text-[18px]">
                    {copyLabel === 'copied' ? 'check_circle' : copyLabel === 'error' ? 'error' : 'content_copy'}
                  </span>
                  {copyLabel === 'copied' ? 'Copied!' : copyLabel === 'error' ? 'Copy failed' : 'Copy backup to clipboard'}
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
          {/* Hidden file input for import — must live in DOM to receive the click */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}
    </div>
    </div>
  )
}
