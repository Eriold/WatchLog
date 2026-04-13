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

declare global {
  interface WindowOrWorkerGlobalScope {
    Translator?: ChromeTranslatorFactory
  }
}

const chromeAiGlobal = globalThis as typeof globalThis & {
  Translator?: ChromeTranslatorFactory
}

const titleTranslationCache = new Map<string, Promise<string[]>>()
const translatorSessionCache = new Map<string, Promise<ChromeTranslatorSession | null>>()
const TITLE_TRANSLATION_LOG_PREFIX = '[WatchLog][TitleTranslation]'

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

  if (/[áéíóúñÁÉÍÓÚÑ¿¡]/u.test(text) || /\b(?:de|del|la|el|los|las|y|en)\b/i.test(text)) {
    return 'es'
  }

  return 'en'
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

async function translateText(text: string, targetLanguage: string): Promise<string | null> {
  const trimmed = text.trim()
  const normalizedTarget = normalizeLanguageTag(targetLanguage)
  if (!trimmed || !normalizedTarget) {
    return null
  }

  const sourceLanguage = inferFallbackSourceLanguage(trimmed)
  if (!sourceLanguage || sourceLanguage === normalizedTarget) {
    console.info(`${TITLE_TRANSLATION_LOG_PREFIX} Skip translate`, {
      text: trimmed,
      sourceLanguage,
      targetLanguage: normalizedTarget,
      reason: 'source-language-equals-target-or-missing',
    })
    return null
  }

  const translator = await getTranslatorSession(sourceLanguage, normalizedTarget)
  if (!translator) {
    console.warn(`${TITLE_TRANSLATION_LOG_PREFIX} Translator unavailable`, {
      text: trimmed,
      sourceLanguage,
      targetLanguage: normalizedTarget,
    })
    return null
  }

  try {
    const translatedText = (await translator.translate(trimmed)).trim()
    const nextValue = translatedText && translatedText !== trimmed ? translatedText : null
    console.info(`${TITLE_TRANSLATION_LOG_PREFIX} Translation result`, {
      text: trimmed,
      sourceLanguage,
      targetLanguage: normalizedTarget,
      translatedText: nextValue,
    })
    return nextValue
  } catch (error) {
    console.error(`${TITLE_TRANSLATION_LOG_PREFIX} Translation failed`, {
      text: trimmed,
      sourceLanguage,
      targetLanguage: normalizedTarget,
      error,
    })
    return null
  }
}

export async function getTranslatedTitleCandidates(title: string): Promise<string[]> {
  const trimmed = title.trim()
  if (!trimmed) {
    return []
  }

  const cached = titleTranslationCache.get(trimmed)
  if (cached) {
    console.info(`${TITLE_TRANSLATION_LOG_PREFIX} Cache hit`, { title: trimmed })
    return cached
  }

  const translationPromise = (async () => {
    const candidates = [trimmed]
    const english = await translateText(trimmed, 'en')
    if (english) {
      candidates.push(english)
    }

    return candidates
  })().catch(() => [trimmed])

  titleTranslationCache.set(trimmed, translationPromise)
  return translationPromise
}
