import { createContext } from 'react'
import type { LocalePreference, SupportedLocale, TranslationKey, TranslationParams } from './translations'

export interface I18nValue {
  locale: SupportedLocale
  browserLocale: SupportedLocale
  preference: LocalePreference
  setPreference: (next: LocalePreference) => Promise<void>
  t: (key: TranslationKey, params?: TranslationParams) => string
}

export const I18nContext = createContext<I18nValue | null>(null)
