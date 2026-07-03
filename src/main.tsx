import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { getGlassMode } from './lib/glassMode'

// Resolve the glass rendering mode before first paint so the stylesheet's
// .glass-<mode> rules apply from the start (see docs/liquid-glass-webgl-plan.md)
getGlassMode()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
