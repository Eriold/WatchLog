import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nProvider } from '../shared/i18n/provider'
import '../shared/theme.css'
import { SidePanelApp } from './App'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Side panel root element not found.')
}

createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <SidePanelApp />
    </I18nProvider>
  </StrictMode>,
)
