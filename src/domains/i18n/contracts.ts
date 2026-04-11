export type SupportedLocale = 'en' | 'es'
export type LocalePreference = SupportedLocale | 'auto'

export const DEFAULT_LOCALE_PREFERENCE: LocalePreference = 'auto'

export interface TranslationParams {
  [key: string]: string | number
}
