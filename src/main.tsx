import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { getGlassMode } from './lib/glassMode'
import { initTheme } from './lib/theme'
import { migrateStorageKeys } from './lib/storageMigration'

// Resolve the glass rendering mode before first paint so the stylesheet's
// .glass-<mode> rules apply from the start (see docs/liquid-glass-webgl-plan.md)
getGlassMode()
// Rename fallout: pull any pre-Polon keys forward before anything reads them.
migrateStorageKeys()
// Before first paint, so a light-mode user never sees a dark flash.
initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
