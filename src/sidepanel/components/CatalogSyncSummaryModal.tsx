/** Renders the summary modal after sequential pending-sync completes, grouping successes and failures. */
import type { I18nValue } from '../../shared/i18n/context'
import type { CatalogSyncSummary } from '../types'
import { CloseIcon } from './SidePanelIcons'

type CatalogSyncSummaryModalProps = {
  catalogSyncSummary: CatalogSyncSummary | null
  onClose: () => void
  t: I18nValue['t']
}

export function CatalogSyncSummaryModal({
  catalogSyncSummary,
  onClose,
  t,
}: CatalogSyncSummaryModalProps) {
  if (!catalogSyncSummary) return null

  return (
    <div className="library-modal-backdrop" role="presentation">
      <div className="library-modal panel library-sync-summary-modal" role="dialog" aria-modal="true">
        <div className="list-settings-header">
          <div>
            <p className="library-detail-kicker">{t('library.syncSummaryKicker')}</p>
            <h3 className="list-settings-title">{t('library.syncSummaryTitle')}</h3>
          </div>
          <button className="list-settings-close" type="button" aria-label={t('common.close')} onClick={onClose}>
            <CloseIcon className="list-settings-close-icon" />
          </button>
        </div>

        <p className="library-detail-copy">
          {t('library.syncSummaryBody', {
            total: catalogSyncSummary.total,
            resolved: catalogSyncSummary.resolvedTitles.length,
            failed: catalogSyncSummary.failedItems.length,
          })}
        </p>

        {catalogSyncSummary.resolvedTitles.length > 0 ? (
          <div className="library-sync-summary-section">
            <p className="library-sync-summary-heading">
              {t('library.syncSummaryResolved', { count: catalogSyncSummary.resolvedTitles.length })}
            </p>
            <div className="library-sync-summary-list">
              {catalogSyncSummary.resolvedTitles.map((title) => (
                <div key={title} className="library-sync-summary-item"><strong>{title}</strong></div>
              ))}
            </div>
          </div>
        ) : null}

        {catalogSyncSummary.failedItems.length > 0 ? (
          <div className="library-sync-summary-section">
            <p className="library-sync-summary-heading">
              {t('library.syncSummaryFailed', { count: catalogSyncSummary.failedItems.length })}
            </p>
            <div className="library-sync-summary-list">
              {catalogSyncSummary.failedItems.map((item) => (
                <div key={`${item.title}:${item.reason}`} className="library-sync-summary-item">
                  <strong>{item.title}</strong>
                  <span>{item.reason}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="library-modal-actions">
          <button className="button" type="button" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  )
}
