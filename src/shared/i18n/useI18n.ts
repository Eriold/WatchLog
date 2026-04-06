import { useContext } from 'react'
import { I18nContext } from './context'
import type { I18nValue } from './context'

export function useI18n(): I18nValue {
  const context = useContext(I18nContext)

  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider.')
  }

  return context
}
