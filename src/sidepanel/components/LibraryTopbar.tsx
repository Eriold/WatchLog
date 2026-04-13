/** Renders the top header, search box, language selector, and current status badge. */
import type { FormEvent } from 'react'
import { EXPLORER_TAB_ID } from '../../shared/constants'
import type { I18nValue } from '../../shared/i18n/context'
import { LanguageSelect } from '../../shared/ui/LanguageSelect'

type LibraryTopbarProps = {
  explorerQuery: string
  libraryQuery: string
  onExplorerQueryChange: (value: string) => void
  onLibraryQueryChange: (value: string) => void
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void
  selectedViewId: string
  showTopbarError: boolean
  statusMessage: string
  subtitle: string
  t: I18nValue['t']
}

export function LibraryTopbar({
  explorerQuery,
  libraryQuery,
  onExplorerQueryChange,
  onLibraryQueryChange,
  onSearchSubmit,
  selectedViewId,
  showTopbarError,
  statusMessage,
  subtitle,
  t,
}: LibraryTopbarProps) {
  const isExplorer = selectedViewId === EXPLORER_TAB_ID

  return (
    <header className="library-topbar">
      <div>
        <h2 className="library-topbar-title">{t('library.topbarTitle')}</h2>
        <p className="library-topbar-subtitle">{subtitle}</p>
      </div>
      <div className="library-topbar-actions">
        <form className="library-search-group" onSubmit={onSearchSubmit}>
          <label className="library-search">
            <span>{t('common.search')}</span>
            <input
              value={isExplorer ? explorerQuery : libraryQuery}
              placeholder={isExplorer ? t('library.searchExplorerPlaceholder') : t('library.searchLibraryPlaceholder')}
              onChange={(event) =>
                isExplorer ? onExplorerQueryChange(event.target.value) : onLibraryQueryChange(event.target.value)
              }
            />
          </label>
          {isExplorer ? (
            <button className="library-chip-button" type="submit">
              {t('library.searchAction')}
            </button>
          ) : null}
        </form>
        <LanguageSelect className="library-language-select" compact />
        {!isExplorer ? (
          showTopbarError ? (
            <span className="library-status-chip">{statusMessage}</span>
          ) : (
            <span className="library-storage-badge" title={statusMessage}>
              {t('library.localStoredBadge')}
            </span>
          )
        ) : null}
      </div>
    </header>
  )
}
