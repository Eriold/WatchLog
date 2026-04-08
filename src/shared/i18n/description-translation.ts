import type { SupportedLocale } from './translations'

type ChromeAiAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available'

interface ChromeTranslatorOptions {
  sourceLanguage: string
  targetLanguage: string
  monitor?: (monitor: EventTarget) => void
}

interface ChromeTranslatorSession {
  ready?: Promise<unknown>
  translate: (input: string) => Promise<string>
  destroy?: () => void
}

interface ChromeTranslatorFactory {
  availability: (options: {
    sourceLanguage: string
    targetLanguage: string
  }) => Promise<ChromeAiAvailability>
  create: (options: ChromeTranslatorOptions) => Promise<ChromeTranslatorSession>
}

interface ChromeLanguageDetectionResult {
  detectedLanguage: string
  confidence: number
}

interface ChromeLanguageDetectorSession {
  ready?: Promise<unknown>
  detect: (input: string) => Promise<ChromeLanguageDetectionResult[]>
  destroy?: () => void
}

interface ChromeLanguageDetectorFactory {
  availability: () => Promise<ChromeAiAvailability>
  create: () => Promise<ChromeLanguageDetectorSession>
}

declare global {
  interface WindowOrWorkerGlobalScope {
    Translator?: ChromeTranslatorFactory
    LanguageDetector?: ChromeLanguageDetectorFactory
  }
}

const chromeAiGlobal = globalThis as typeof globalThis & {
  Translator?: ChromeTranslatorFactory
  LanguageDetector?: ChromeLanguageDetectorFactory
}

export interface DescriptionTranslationResult {
  text: string
  translated: boolean
}

const DESCRIPTION_TARGET_LOCALE: SupportedLocale = 'es'
const translationCache = new Map<string, Promise<DescriptionTranslationResult>>()
const translatorSessionCache = new Map<string, Promise<ChromeTranslatorSession | null>>()
let detectorSessionPromise: Promise<ChromeLanguageDetectorSession | null> | null = null

function normalizeLanguageTag(value?: string | null): string {
  return value?.trim().toLowerCase().split('-')[0] ?? ''
}

function hasUserActivation(): boolean {
  return typeof navigator !== 'undefined' && navigator.userActivation?.isActive === true
}

function inferFallbackSourceLanguage(text: string): string {
  if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/u.test(text)) {
    return 'ja'
  }

  if (/[\uac00-\ud7af]/u.test(text)) {
    return 'ko'
  }

  if (/[\u0400-\u04ff]/u.test(text)) {
    return 'ru'
  }

  if (/[¿¡]/u.test(text)) {
    return 'es'
  }

  return 'en'
}

async function getLanguageDetectorSession(): Promise<ChromeLanguageDetectorSession | null> {
  if (!chromeAiGlobal.LanguageDetector) {
    return null
  }

  if (!detectorSessionPromise) {
    detectorSessionPromise = (async () => {
      try {
        const availability = await chromeAiGlobal.LanguageDetector!.availability()
        if (availability === 'unavailable' || availability === 'downloading') {
          return null
        }

        if (availability === 'downloadable' && !hasUserActivation()) {
          return null
        }

        const detector = await chromeAiGlobal.LanguageDetector!.create()
        await detector.ready
        return detector
      } catch {
        return null
      }
    })()
  }

  return detectorSessionPromise
}

async function detectSourceLanguage(text: string): Promise<string> {
  try {
    const detector = await getLanguageDetectorSession()
    if (!detector) {
      return inferFallbackSourceLanguage(text)
    }

    const results = await detector.detect(text)
    const bestMatch = results[0]
    const normalized = normalizeLanguageTag(bestMatch?.detectedLanguage)

    if (normalized && (bestMatch?.confidence ?? 0) >= 0.5) {
      return normalized
    }
  } catch {
    return inferFallbackSourceLanguage(text)
  }

  return inferFallbackSourceLanguage(text)
}

async function getTranslatorSession(
  sourceLanguage: string,
  targetLanguage: string,
): Promise<ChromeTranslatorSession | null> {
  if (!chromeAiGlobal.Translator) {
    return null
  }

  const normalizedSource = normalizeLanguageTag(sourceLanguage)
  const normalizedTarget = normalizeLanguageTag(targetLanguage)
  const cacheKey = `${normalizedSource}:${normalizedTarget}`

  if (!normalizedSource || !normalizedTarget || normalizedSource === normalizedTarget) {
    return null
  }

  const existing = translatorSessionCache.get(cacheKey)
  if (existing) {
    return existing
  }

  const sessionPromise = (async () => {
    try {
      const availability = await chromeAiGlobal.Translator!.availability({
        sourceLanguage: normalizedSource,
        targetLanguage: normalizedTarget,
      })

      if (availability === 'unavailable' || availability === 'downloading') {
        return null
      }

      if (availability === 'downloadable' && !hasUserActivation()) {
        return null
      }

      const translator = await chromeAiGlobal.Translator!.create({
        sourceLanguage: normalizedSource,
        targetLanguage: normalizedTarget,
      })
      await translator.ready
      return translator
    } catch {
      return null
    }
  })()

  translatorSessionCache.set(cacheKey, sessionPromise)
  return sessionPromise
}

export async function translateDescription(
  text: string,
  locale: SupportedLocale,
): Promise<DescriptionTranslationResult> {
  const trimmed = text.trim()
  if (!trimmed || locale !== DESCRIPTION_TARGET_LOCALE) {
    return {
      text: trimmed,
      translated: false,
    }
  }

  const cacheKey = `${locale}:${trimmed}`
  const cached = translationCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const translationPromise = (async () => {
    try {
      const sourceLanguage = await detectSourceLanguage(trimmed)
      if (!sourceLanguage || sourceLanguage === locale) {
        return {
          text: trimmed,
          translated: false,
        }
      }

      const translator = await getTranslatorSession(sourceLanguage, locale)
      if (!translator) {
        return {
          text: trimmed,
          translated: false,
        }
      }

      const translatedText = (await translator.translate(trimmed)).trim()
      if (!translatedText || translatedText === trimmed) {
        return {
          text: trimmed,
          translated: false,
        }
      }

      return {
        text: translatedText,
        translated: true,
      }
    } catch {
      return {
        text: trimmed,
        translated: false,
      }
    }
  })().catch(() => ({
    text: trimmed,
    translated: false,
  }))

  translationCache.set(cacheKey, translationPromise)
  return translationPromise
}
