/** Renders the popup topbar and keeps the header layout isolated from popup state management. */
import { LanguageSelect } from '../../shared/ui/LanguageSelect'
import type { PopupTranslate } from '../utils/popup-helpers'
import { OpenInNewIcon } from './PopupIcons'

interface PopupHeaderProps {
  onOpenLibrary: () => void
  t: PopupTranslate
}

export function PopupHeader({ onOpenLibrary, t }: PopupHeaderProps) {
  return (
    <header className="popup-topbar">
      <div className="brand-lockup popup-brand">
        <img className="brand-icon" src="/icons/android-chrome-192x192.png" alt="WatchLog logo" />
        <div>
          <p className="tiny popup-brand-kicker">{t('common.appName')}</p>
          <strong className="popup-brand-name">{t('popup.quickPopup')}</strong>
        </div>
      </div>
      <div className="popup-topbar-actions">
        <span className="chip popup-mode-chip">
          <span className="status-dot" />
          {t('common.localFirst')}
        </span>
        <LanguageSelect className="popup-language-select" compact />
        <button
          className="icon-surface-button"
          type="button"
          title={t('popup.openFullLibrary')}
          onClick={onOpenLibrary}
        >
          <OpenInNewIcon />
        </button>
      </div>
    </header>
  )
}
