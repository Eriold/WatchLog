import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../shared/theme.css'
import { SidePanelApp } from './App'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Side panel root element not found.')
}

createRoot(root).render(
  <StrictMode>
    <SidePanelApp />
  </StrictMode>,
)
