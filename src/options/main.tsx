import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nProvider } from '../shared/i18n/provider'
import '../shared/theme.css'
import { OptionsApp } from './App'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Options root element not found.')
}

createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <OptionsApp />
    </I18nProvider>
  </StrictMode>,
)
