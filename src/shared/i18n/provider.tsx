import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { STORAGE_KEYS } from '../constants'
import { storageGet, storageSet } from '../storage/browser'
import { I18nContext, type I18nValue } from './context'
import {
  DEFAULT_LOCALE_PREFERENCE,
  resolveLocale,
  translate,
  type LocalePreference,
  type SupportedLocale,
  type TranslationKey,
  type TranslationParams,
} from './translations'

function getBrowserLocale(): SupportedLocale {
  const uiLanguage =
    typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage
      ? chrome.i18n.getUILanguage()
      : navigator.language

  return resolveLocale(uiLanguage)
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const browserLocale = getBrowserLocale()
  const [preference, setPreferenceState] = useState<LocalePreference>(DEFAULT_LOCALE_PREFERENCE)
  const [locale, setLocale] = useState<SupportedLocale>(browserLocale)

  useEffect(() => {
    let cancelled = false

    const loadPreference = async () => {
      const stored = await storageGet<LocalePreference>(
        chrome.storage.local,
        STORAGE_KEYS.locale,
        DEFAULT_LOCALE_PREFERENCE,
      )

      if (cancelled) {
        return
      }

      setPreferenceState(stored)
      setLocale(stored === 'auto' ? browserLocale : resolveLocale(stored))
    }

    void loadPreference()

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName !== 'local' || !(STORAGE_KEYS.locale in changes)) {
        return
      }

      const nextPreference =
        (changes[STORAGE_KEYS.locale]?.newValue as LocalePreference | undefined) ??
        DEFAULT_LOCALE_PREFERENCE

      setPreferenceState(nextPreference)
      setLocale(nextPreference === 'auto' ? browserLocale : resolveLocale(nextPreference))
    }

    chrome.storage.onChanged.addListener(handleStorageChange)

    return () => {
      cancelled = true
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [browserLocale])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setPreference = useCallback(
    async (next: LocalePreference) => {
      setPreferenceState(next)
      setLocale(next === 'auto' ? browserLocale : resolveLocale(next))
      await storageSet(chrome.storage.local, STORAGE_KEYS.locale, next)
    },
    [browserLocale],
  )

  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams) => translate(locale, key, params),
    [locale],
  )

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      preference,
      setPreference,
      t,
    }),
    [locale, preference, setPreference, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
