import { useI18n } from '../i18n/useI18n'
import type { LocalePreference } from '../i18n/translations'
import { CustomSelect } from './CustomSelect'

interface LanguageSelectProps {
  className?: string
  compact?: boolean
}

export function LanguageSelect({ className, compact = false }: LanguageSelectProps) {
  const { browserLocale, preference, setPreference, t } = useI18n()
  const autoLabel = browserLocale === 'es' ? t('language.spanish') : t('language.english')

  return (
    <label className={className}>
      {!compact ? <span className="label">{t('language.label')}</span> : null}
      <CustomSelect
        className={compact ? 'compact-language-select' : undefined}
        value={preference}
        ariaLabel={t('language.label')}
        onChange={(value) => void setPreference(value as LocalePreference)}
        options={[
          { value: 'auto', label: autoLabel },
          { value: 'en', label: t('language.english') },
          { value: 'es', label: t('language.spanish') },
        ]}
      />
    </label>
  )
}
