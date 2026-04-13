/** Renders the queue-list settings drawer for rename, clear, and delete operations. */
import { formatLocalizedDate } from '../../shared/i18n/helpers'
import type { I18nValue } from '../../shared/i18n/context'
import type { WatchListDefinition } from '../../shared/types'
import { CloseIcon } from './SidePanelIcons'

type ListSettingsDrawerProps = {
  activeListSettings: WatchListDefinition | null
  itemCount: number
  listNameDraft: string
  locale: I18nValue['locale']
  onClose: () => void
  onListNameDraftChange: (value: string) => void
  onRequestClearList: () => void
  onRequestDeleteList: () => void
  onSaveListName: () => void
  t: I18nValue['t']
}

export function ListSettingsDrawer({
  activeListSettings,
  itemCount,
  listNameDraft,
  locale,
  onClose,
  onListNameDraftChange,
  onRequestClearList,
  onRequestDeleteList,
  onSaveListName,
  t,
}: ListSettingsDrawerProps) {
  return (
    <aside className={`list-settings-drawer ${activeListSettings ? 'is-open' : ''}`}>
      {activeListSettings ? (
        <>
          <div className="list-settings-header">
            <div>
              <p className="library-detail-kicker">{t('library.listSettings')}</p>
              <h3 className="list-settings-title">{activeListSettings.label}</h3>
            </div>
            <button className="list-settings-close" type="button" aria-label={t('common.close')} onClick={onClose}>
              <CloseIcon className="list-settings-close-icon" />
            </button>
          </div>

          <div className="list-settings-metrics">
            <div className="field-card">
              <span className="list-settings-metric-label">{t('library.listCreatedAt')}</span>
              <strong>{activeListSettings.createdAt ? formatLocalizedDate(activeListSettings.createdAt, locale) : t('common.unknown')}</strong>
            </div>
            <div className="field-card">
              <span className="list-settings-metric-label">{t('library.listItemCount')}</span>
              <strong>{t(itemCount === 1 ? 'library.items.one' : 'library.items.other', { count: itemCount })}</strong>
            </div>
          </div>

          <div className="field-card list-settings-section">
            <label className="label" htmlFor="list-name-draft">{t('library.listName')}</label>
            <input
              id="list-name-draft"
              className="field"
              value={listNameDraft}
              disabled={activeListSettings.kind !== 'custom'}
              onChange={(event) => onListNameDraftChange(event.target.value)}
            />
            <button
              className="button secondary"
              type="button"
              disabled={activeListSettings.kind !== 'custom' || listNameDraft.trim() === activeListSettings.label}
              onClick={onSaveListName}
            >
              {t('library.saveListName')}
            </button>
          </div>

          <div className="field-card list-settings-section">
            <p className="list-settings-action-copy">{t('library.clearListConfirmBody', { label: activeListSettings.label })}</p>
            <button className="button secondary" type="button" onClick={onRequestClearList}>
              {t('library.clearList')}
            </button>
          </div>

          {activeListSettings.kind === 'custom' ? (
            <div className="field-card list-settings-section list-settings-danger">
              <p className="list-settings-action-copy">{t('library.deleteListConfirmBody', { label: activeListSettings.label })}</p>
              <button className="button danger" type="button" onClick={onRequestDeleteList}>
                {t('library.deleteList')}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </aside>
  )
}
