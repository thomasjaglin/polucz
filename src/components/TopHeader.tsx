import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import IconButton from './IconButton'
import GlassPane from './GlassPane'
import GlassButton from './GlassButton'
import type { PageId, VocabEntry } from '../data/types'
import { getCards, replaceAllCards } from '../lib/storage'
import { getAllReviews, replaceAllReviews } from '../lib/reviewStorage'
import { saveSentences } from '../lib/sentenceStorage'
import { useTTS } from '../lib/useTTS'
import { pushToast } from '../lib/toastStore'
import { useBackClose } from '../hooks/useBackClose'
import { getGlassMode } from '../lib/glassMode'

interface Props {
  activeId: PageId
  onChangePage: (id: PageId) => void
  onImport: () => void
  cards: VocabEntry[]
  onAudioReady: (id: string) => void
  hidden?: boolean
  // Notifies App to hide the background glass panes while the prepare-audio modal
  // is open, so the modal's own pane wins the renderer's smallest-area pick and
  // its rim/side light draws (same trick the word-detail modal uses).
  onPrepOpenChange?: (open: boolean) => void
}

// Space between cards while preparing audio. Each card is 2 TTS requests; the
// provider caps at 10/min, so ~13 s/card keeps us safely under it.
const PREP_SPACING_MS = 13000

// Glassy pill treatment for the prepare-audio modal buttons — mirrors the
// add-words page buttons: a bright rim + inset highlight over the GlassPane.
// Pair with radius={999}, a `pane` tint and a border/text colour per button.
const MODAL_BTN = 'h-[46px] overflow-hidden font-instrument text-[15px] font-semibold border shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_4px_12px_rgba(0,0,0,0.2)]'

export default function TopHeader({ activeId, onChangePage, onImport, cards, onAudioReady, hidden = false, onPrepOpenChange }: Props) {
  const glassMode = getGlassMode()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const settingsBtnRef = useRef<HTMLButtonElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const tts = useTTS()

  // ─── Prepare-audio batch ───────────────────────────────────────────────────
  const [prepConfirm, setPrepConfirm] = useState(false)
  const [prepProgress, setPrepProgress] = useState<{ done: number; total: number } | null>(null)
  const prepCancel = useRef(false)
  const incompleteCount = cards.filter(c => !c.audioReady).length

  async function runPrepare() {
    const todo = cards.filter(c => !c.audioReady)
    setPrepConfirm(false)
    if (todo.length === 0) return
    prepCancel.current = false
    setPrepProgress({ done: 0, total: todo.length })
    for (let i = 0; i < todo.length; i++) {
      if (prepCancel.current) break
      const ok = await tts.prefetch(todo[i].pl, todo[i].en)
      if (ok) onAudioReady(todo[i].id)
      setPrepProgress({ done: i + 1, total: todo.length })
      // Throttle between cards to respect the TTS rate limit.
      if (i < todo.length - 1 && !prepCancel.current) {
        await new Promise(r => setTimeout(r, PREP_SPACING_MS))
      }
    }
    setPrepProgress(null)
  }

  // Android back closes these overlays instead of exiting the app.
  useBackClose(settingsOpen, () => setSettingsOpen(false))
  useBackClose(prepConfirm, () => setPrepConfirm(false))

  // Hide the background panes while the prepare-audio modal is open (see prop).
  useEffect(() => { onPrepOpenChange?.(prepConfirm) }, [prepConfirm, onPrepOpenChange])

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
  const [syncState, setSyncState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

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

  async function handleSyncSentences() {
    setSyncState('loading')
    try {
      const res = await fetch('/approved-sentences.json')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (!Array.isArray(data.sentences)) throw new Error('Invalid format')
      saveSentences(data.sentences)
      setSyncState('done')
      setTimeout(() => { setSyncState('idle'); setSettingsOpen(false) }, 1500)
    } catch {
      setSyncState('error')
      setTimeout(() => { setSyncState('idle'); setSettingsOpen(false) }, 2000)
    }
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
          pushToast('Invalid backup file', 'error')
          return
        }
        replaceAllCards(data.cards)
        replaceAllReviews(data.reviews)
        if (Array.isArray(data.sentences) && data.sentences.length > 0) {
          saveSentences(data.sentences)
        }
        onImport()
        pushToast(`Imported ${data.cards.length} cards`, 'success')
      } catch {
        pushToast('Could not read the file — not a valid Polucz backup', 'error')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // Secondary pages: back button only, no logo
  if (activeId === 'add_page' || activeId === 'api_config') {
    return (
      <div
        className="absolute left-6 z-50 flex items-center gap-3"
        style={{ top: 'calc(1rem + env(safe-area-inset-top))' }}
      >
        <IconButton icon="arrow_back" onClick={() => onChangePage('folder')} />
      </div>
    )
  }

  // Main nav pages: logo centered + optional right-side actions
  return (
    <div className={`absolute inset-x-0 top-0 z-50 transition-transform duration-300 ease-in-out ${hidden ? '-translate-y-full' : 'translate-y-0'}`}>
    <div
      className="relative mx-auto flex max-w-[426px] items-center justify-center px-6"
      style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
    >
      {/* Folder-only: add + settings buttons on the right.
          Explicit `top` (not relying on the parent's paddingTop): as an
          absolutely-positioned child of a flex container, a `top`-less box
          lands at the viewport's top edge and clips the buttons. Mirrors the
          back-button path above; ~20px clears them with breathing room. */}
      {activeId === 'folder' && (
        <div
          className="absolute right-6 flex items-center gap-3"
          style={{ top: 'calc(1.25rem + env(safe-area-inset-top))' }}
        >
          {/* Prepare audio for all cards missing it (left of add + settings).
              While running it becomes a glass pill: "done/total" + spinner. */}
          {prepProgress ? (
            <button
              onClick={() => setPrepConfirm(true)}
              aria-label={`Preparing audio ${prepProgress.done} of ${prepProgress.total}`}
              className="relative flex h-[42px] items-center gap-2 rounded-full px-4 shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_0_0_1px_rgba(255,255,255,0.12)] transition-all hover:scale-105 active:scale-95"
            >
              <GlassPane borderRadius={21} className="absolute inset-0 z-0 rounded-full bg-ink/[0.02]" />
              <span className="relative z-10 font-instrument text-[13px] font-medium tabular-nums text-ink/80">
                {prepProgress.done}/{prepProgress.total}
              </span>
              <span className="material-symbols-rounded relative z-10 animate-spin text-[18px] text-ink">progress_activity</span>
            </button>
          ) : (
            <IconButton icon="download_for_offline" onClick={() => setPrepConfirm(true)} />
          )}
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
                className="absolute right-0 top-[50px] z-[100] w-[200px] overflow-hidden rounded-[24px] border border-ink/10 shadow-2xl"
              >
                <GlassPane borderRadius={24} className="absolute inset-0 z-0 rounded-[24px] bg-surface/60" />
                <div className="relative z-10 flex flex-col">
                <button
                  onClick={handleImportClick}
                  className="flex w-full items-center gap-3 border-b border-ink/5 px-5 py-3.5 text-left font-instrument text-[15px] font-medium text-ink/80 transition-colors hover:bg-ink/10 hover:text-ink"
                >
                  <span className="material-symbols-rounded text-[18px]">download</span>
                  Import JSON
                </button>
                <button
                  onClick={handleExport}
                  className="flex w-full items-center gap-3 border-b border-ink/5 px-5 py-3.5 text-left font-instrument text-[15px] font-medium text-ink/80 transition-colors hover:bg-ink/10 hover:text-ink"
                >
                  <span className="material-symbols-rounded text-[18px]">upload</span>
                  Export JSON
                </button>
                <button
                  onClick={handleCopyToClipboard}
                  className="flex w-full items-center gap-3 border-b border-ink/5 px-5 py-3.5 text-left font-instrument text-[15px] font-medium text-ink/80 transition-colors hover:bg-ink/10 hover:text-ink"
                  style={copyLabel === 'copied' ? { color: 'var(--ok)' } : copyLabel === 'error' ? { color: 'var(--err)' } : undefined}
                >
                  <span className="material-symbols-rounded text-[18px]">
                    {copyLabel === 'copied' ? 'check_circle' : copyLabel === 'error' ? 'error' : 'content_copy'}
                  </span>
                  {copyLabel === 'copied' ? 'Copied!' : copyLabel === 'error' ? 'Copy failed' : 'Copy backup to clipboard'}
                </button>
                <button
                  onClick={handleSyncSentences}
                  disabled={syncState === 'loading'}
                  className="flex w-full items-center gap-3 border-b border-ink/5 px-5 py-3.5 text-left font-instrument text-[15px] font-medium text-ink/80 transition-colors hover:bg-ink/10 hover:text-ink disabled:pointer-events-none"
                  style={syncState === 'done' ? { color: 'var(--ok)' } : syncState === 'error' ? { color: 'var(--err)' } : undefined}
                >
                  <span className={`material-symbols-rounded text-[18px]${syncState === 'loading' ? ' animate-spin' : ''}`}>
                    {syncState === 'done' ? 'check_circle' : syncState === 'error' ? 'error' : syncState === 'loading' ? 'progress_activity' : 'sync'}
                  </span>
                  {syncState === 'done' ? 'Synced!' : syncState === 'error' ? 'Sync failed' : syncState === 'loading' ? 'Syncing…' : 'Sync sentences'}
                </button>
                <button
                  onClick={() => { onChangePage('api_config'); setSettingsOpen(false) }}
                  className="flex w-full items-center gap-3 border-b border-ink/5 px-5 py-3.5 text-left font-instrument text-[15px] font-medium text-ink/80 transition-colors hover:bg-ink/10 hover:text-ink"
                >
                  <span className="material-symbols-rounded text-[18px]">settings</span>
                  App settings
                </button>
                <button
                  onClick={() => { window.location.href = '/?lab' }}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left font-instrument text-[15px] font-medium text-ink/80 transition-colors hover:bg-ink/10 hover:text-ink"
                >
                  <span className="material-symbols-rounded text-[18px]">science</span>
                  Glass lab
                </button>
                </div>
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

    {/* Prepare-audio confirmation / progress modal — portalled to <body> so it's
        positioned relative to the viewport, not the header's transformed
        (translate-y) container which would otherwise capture `position: fixed`. */}
    {prepConfirm && createPortal(
      <div
        className="fixed inset-0 z-[110] flex items-center justify-center p-6"
        onClick={e => { if (e.target === e.currentTarget && !prepProgress) setPrepConfirm(false) }}
      >
        {/* Dimmed backdrop to focus attention on the modal. In webgl mode it's a
            flat tint only — a backdrop-blur here would blur (and wash out) the
            per-element glass rim the canvas draws behind the panel. */}
        <div
          className={`pointer-events-none absolute inset-0 z-0 ${glassMode === 'webgl' ? '' : 'backdrop-blur-lg'}`}
          style={{ background: 'var(--veil-header)' }}
        />
        <div className="relative z-10 w-full max-w-[340px] overflow-hidden rounded-[36px] p-6 shadow-[0_16px_64px_rgba(0,0,0,0.5),inset_0_0_0_1px_rgba(255,255,255,0.12)]">
          <GlassPane borderRadius={36} className="absolute inset-0 z-0 rounded-[36px] bg-ink/[0.02]" />
          <div className="relative z-10 flex flex-col gap-4">
            {prepProgress ? (
              <>
                <h2 className="font-instrument text-[20px] font-semibold text-ink/90">Preparing audio…</h2>
                <p className="font-instrument text-[14px] text-ink/50">
                  {prepProgress.done} / {prepProgress.total} cards. This keeps running in the background — you can close this and keep using the app.
                </p>
                <div className="h-[4px] w-full overflow-hidden rounded-full bg-ink/10">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(prepProgress.done / Math.max(prepProgress.total, 1)) * 100}%` }} />
                </div>
                <div className="mt-1 flex gap-3">
                  <GlassButton onClick={() => setPrepConfirm(false)} radius={999} pane="bg-ink/5" className={`${MODAL_BTN} flex-1 border-ink/20 text-ink/80`}>
                    Run in background
                  </GlassButton>
                  <GlassButton onClick={() => { prepCancel.current = true; setPrepProgress(null); setPrepConfirm(false) }} radius={999} pane="bg-red-400/12" className={`${MODAL_BTN} flex-1 border-red-400/40 text-red-400`}>
                    Stop
                  </GlassButton>
                </div>
              </>
            ) : incompleteCount === 0 ? (
              <>
                <h2 className="font-instrument text-[20px] font-semibold text-ink/90">All caught up</h2>
                <p className="font-instrument text-[14px] text-ink/50">Every card already has its audio prepared.</p>
                <GlassButton onClick={() => setPrepConfirm(false)} radius={999} pane="bg-ink/5" className={`${MODAL_BTN} mt-1 w-full border-ink/20 text-ink/80`}>Close</GlassButton>
              </>
            ) : (
              <>
                <h2 className="font-instrument text-[20px] font-semibold text-ink/90">Prepare audio</h2>
                <p className="font-instrument text-[14px] text-ink/50">
                  Generate and cache audio for <span className="text-accent">{incompleteCount}</span> {incompleteCount === 1 ? 'card' : 'cards'}. It's rate-limited, so it runs slowly in the background (~{Math.ceil((incompleteCount * PREP_SPACING_MS) / 60000)} min) — you can keep using the app.
                </p>
                <div className="mt-1 flex gap-3">
                  <GlassButton onClick={() => setPrepConfirm(false)} radius={999} pane="bg-ink/5" className={`${MODAL_BTN} flex-1 border-ink/20 text-ink/80`}>Cancel</GlassButton>
                  <GlassButton onClick={runPrepare} radius={999} pane="bg-accent/15" className={`${MODAL_BTN} flex-1 border-accent/40 text-accent`}>Prepare</GlassButton>
                </div>
              </>
            )}
          </div>
        </div>
      </div>,
      document.body
    )}
    </div>
  )
}
