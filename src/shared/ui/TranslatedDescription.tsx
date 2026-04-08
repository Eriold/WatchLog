import { useEffect, useState, type ElementType } from 'react'
import type { I18nValue } from '../i18n/context'
import {
  translateDescription,
  type DescriptionTranslationResult,
} from '../i18n/description-translation'
import type { SupportedLocale } from '../i18n/translations'

interface TranslatedDescriptionProps {
  as?: ElementType
  className?: string
  text?: string
  locale: SupportedLocale
  t: I18nValue['t']
  emptyFallback: string
  appendGoogleAttribution?: boolean
}

function getInitialDescriptionState(text?: string): DescriptionTranslationResult {
  return {
    text: text?.trim() ?? '',
    translated: false,
  }
}

export function TranslatedDescription({
  as = 'p',
  className,
  text,
  locale,
  t,
  emptyFallback,
  appendGoogleAttribution = false,
}: TranslatedDescriptionProps) {
  const [state, setState] = useState<DescriptionTranslationResult>(() =>
    getInitialDescriptionState(text),
  )
  const [translationAttempt, setTranslationAttempt] = useState(0)

  useEffect(() => {
    const trimmed = text?.trim() ?? ''
    setState({
      text: trimmed,
      translated: false,
    })

    if (!trimmed) {
      return
    }

    let cancelled = false

    void translateDescription(trimmed, locale)
      .then((nextState) => {
        if (!cancelled) {
          setState(nextState)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            text: trimmed,
            translated: false,
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [locale, text, translationAttempt])

  const Tag = as

  if (!state.text) {
    return <Tag className={className}>{emptyFallback}</Tag>
  }

  const handleRetryTranslation = () => {
    if (locale !== 'es' || state.translated || !text?.trim()) {
      return
    }

    setTranslationAttempt((value) => value + 1)
  }

  return (
    <Tag
      className={className}
      onFocus={handleRetryTranslation}
      onMouseEnter={handleRetryTranslation}
      onPointerDown={handleRetryTranslation}
    >
      {state.text}
      {appendGoogleAttribution && state.translated ? (
        <>
          <br />
          <br />
          <span className="translated-description-attribution">
            {t('description.translatedByGoogle')}
          </span>
        </>
      ) : null}
    </Tag>
  )
}
