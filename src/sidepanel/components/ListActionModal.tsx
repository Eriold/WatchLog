/** Renders the clear/delete list confirmation modal with optional name-confirm input. */
import type { I18nValue } from '../../shared/i18n/context'
import type { ListModalState } from '../types'
import { CloseIcon } from './SidePanelIcons'

type ListActionModalProps = {
  listModalState: ListModalState | null
  onClose: () => void
  onConfirm: () => void
  onInputChange: (value: string) => void
  t: I18nValue['t']
}

export function ListActionModal({
  listModalState,
  onClose,
  onConfirm,
  onInputChange,
  t,
}: ListActionModalProps) {
  if (!listModalState) return null

  return (
    <div className="library-modal-backdrop" role="presentation">
      <div className="library-modal panel" role="dialog" aria-modal="true">
        <div className="list-settings-header">
          <div>
            <p className="library-detail-kicker">
              {listModalState.mode === 'delete' ? t('library.deleteList') : t('library.clearList')}
            </p>
            <h3 className="list-settings-title">
              {listModalState.mode === 'delete' ? t('library.deleteListConfirmTitle') : t('library.clearListConfirmTitle')}
            </h3>
          </div>
          <button className="list-settings-close" type="button" aria-label={t('common.close')} onClick={onClose}>
            <CloseIcon className="list-settings-close-icon" />
          </button>
        </div>

        <p className="library-detail-copy">
          {listModalState.mode === 'delete'
            ? t('library.deleteListConfirmBody', { label: listModalState.label })
            : t('library.clearListConfirmBody', { label: listModalState.label })}
        </p>

        {listModalState.mode === 'delete' ? (
          <div className="field-card list-settings-section">
            <label className="label" htmlFor="delete-list-confirm">{t('library.deleteListTypeName')}</label>
            <input id="delete-list-confirm" className="field" value={listModalState.input} onChange={(event) => onInputChange(event.target.value)} />
          </div>
        ) : null}

        <div className="library-modal-actions">
          <button className="button secondary" type="button" onClick={onClose}>{t('common.cancel')}</button>
          <button className={`button ${listModalState.mode === 'delete' ? 'danger' : ''}`} type="button" onClick={onConfirm}>
            {listModalState.mode === 'delete' ? t('library.confirmDeleteList') : t('library.confirmClearList')}
          </button>
        </div>
      </div>
    </div>
  )
}
