import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../shared/theme.css'
import { OptionsApp } from './App'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Options root element not found.')
}

createRoot(root).render(
  <StrictMode>
    <OptionsApp />
  </StrictMode>,
)
