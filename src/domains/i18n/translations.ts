import type { SupportedLocale, TranslationParams } from './contracts'
import { enTranslations } from './locales/en'
import { esTranslations } from './locales/es'

export const translations = {
  en: enTranslations,
  es: esTranslations,
} as const

export type TranslationKey = keyof typeof translations.en

export function resolveLocale(input?: string | null): SupportedLocale {
  if (!input) {
    return 'en'
  }

  const normalized = input.toLowerCase()
  if (normalized.startsWith('es')) {
    return 'es'
  }

  return 'en'
}

export function translate(
  locale: SupportedLocale,
  key: TranslationKey,
  params?: TranslationParams,
): string {
  const template = translations[locale][key] ?? translations.en[key] ?? key

  if (!params) {
    return template
  }

  return template.replace(/\{(\w+)\}/g, (_match, token: string) => {
    return String(params[token] ?? '')
  })
}
