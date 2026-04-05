import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../shared/theme.css'
import { PopupApp } from './App'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Popup root element not found.')
}

createRoot(root).render(
  <StrictMode>
    <PopupApp />
  </StrictMode>,
)
