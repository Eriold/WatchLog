/** Renders the left navigation rail, queue lists, and list creation/settings entry points. */
import { getLocalizedListDefinitionLabel } from '../../shared/i18n/helpers'
import type { I18nValue } from '../../shared/i18n/context'
import type { WatchListDefinition } from '../../shared/types'
import { NavGlyph, SettingsIcon } from './SidePanelIcons'

type LibrarySidebarProps = {
  newListLabel: string
  onListLabelChange: (value: string) => void
  onOpenListSettings: (listId: string, label: string) => void
  onSelectView: (viewId: string) => void
  onSubmitNewList: () => void
  primaryViews: Array<{ id: string; label: string; icon: 'library' | 'watching' | 'completed' | 'favorites' | 'explorer' }>
  queueLists: WatchListDefinition[]
  selectedViewId: string
  t: I18nValue['t']
  getListEntryCount: (listId: string) => number
  getViewCount: (viewId: string) => number
}

export function LibrarySidebar({
  newListLabel,
  onListLabelChange,
  onOpenListSettings,
  onSelectView,
  onSubmitNewList,
  primaryViews,
  queueLists,
  selectedViewId,
  t,
  getListEntryCount,
  getViewCount,
}: LibrarySidebarProps) {
  return (
    <aside className="library-sidebar">
      <div className="library-sidebar-inner">
        <div className="library-brand">
          <div className="library-brand-mark">
            <img className="brand-icon" src="/icons/favicon-32x32.png" alt="WatchLog logo" />
          </div>
          <div>
            <h1 className="library-brand-title">{t('common.appName')}</h1>
            <p className="library-brand-status">{t('library.statusLocalFirst')}</p>
          </div>
        </div>

        <nav className="library-nav">
          {primaryViews.map((view) => (
            <button
              key={view.id}
              className={`library-nav-button ${selectedViewId === view.id ? 'is-active' : ''}`}
              type="button"
              onClick={() => onSelectView(view.id)}
            >
              <div className={`content-elements ${selectedViewId === view.id ? 'is-active' : ''}`}>
                <span className="library-nav-icon">
                  <NavGlyph kind={view.icon} className="library-nav-icon-symbol" />
                </span>
                <span className="library-nav-copy">
                  <strong>{view.label}</strong>
                  <span>
                    {t(getViewCount(view.id) === 1 ? 'library.items.one' : 'library.items.other', {
                      count: getViewCount(view.id),
                    })}
                  </span>
                </span>
              </div>
            </button>
          ))}
        </nav>

        <div className="library-sidebar-section">
          <p className="library-sidebar-label">{t('library.queues')}</p>
          <div className="library-queue-list">
            {queueLists.map((list) => (
              <div key={list.id} className={`queue-list-item is-removable ${selectedViewId === list.id ? 'is-active' : ''}`}>
                <button className="queue-list-main" type="button" onClick={() => onSelectView(list.id)}>
                  <strong>{getLocalizedListDefinitionLabel(list, t)}</strong>
                  <span>
                    {t(getListEntryCount(list.id) === 1 ? 'library.items.one' : 'library.items.other', {
                      count: getListEntryCount(list.id),
                    })}
                  </span>
                </button>
                <button
                  className="queue-list-settings"
                  type="button"
                  title={t('library.listSettings')}
                  aria-label={t('library.listSettings')}
                  onClick={() => onOpenListSettings(list.id, list.label)}
                >
                  <SettingsIcon className="queue-settings-icon" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="library-sidebar-section">
          <p className="library-sidebar-label">{t('library.createList')}</p>
          <input
            className="field"
            value={newListLabel}
            placeholder={t('library.createListPlaceholder')}
            onChange={(event) => onListLabelChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                onSubmitNewList()
              }
            }}
          />
          <button className="button secondary" type="button" onClick={onSubmitNewList}>
            {t('library.addList')}
          </button>
        </div>

        <button className="library-settings-button" type="button" onClick={() => void chrome.runtime.openOptionsPage()}>
          <SettingsIcon className="library-settings-icon" />
          <span>{t('common.settings')}</span>
        </button>
        <p className="library-settings-attribution tiny">{t('library.sidebarAttribution')}</p>
      </div>
    </aside>
  )
}
