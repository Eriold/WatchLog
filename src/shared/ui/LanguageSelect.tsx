import { useId } from 'react'
import { useI18n } from '../i18n/useI18n'
import type { LocalePreference } from '../i18n/translations'

interface LanguageSelectProps {
  className?: string
  compact?: boolean
}

export function LanguageSelect({ className, compact = false }: LanguageSelectProps) {
  const { browserLocale, preference, setPreference, t } = useI18n()
  const selectId = useId()
  const autoLabel = browserLocale === 'es' ? t('language.spanish') : t('language.english')

  return (
    <label className={className} htmlFor={selectId}>
      {!compact ? <span className="label">{t('language.label')}</span> : null}
      <select
        id={selectId}
        className={`select ${compact ? 'compact-language-select' : ''}`}
        value={preference}
        onChange={(event) => void setPreference(event.target.value as LocalePreference)}
      >
        <option value="auto">{autoLabel}</option>
        <option value="en">{t('language.english')}</option>
        <option value="es">{t('language.spanish')}</option>
      </select>
    </label>
  )
}
