/** Renders the delete-entry confirmation modal for library items. */
import type { I18nValue } from '../../shared/i18n/context'
import type { EntryDeleteState } from '../types'
import { CloseIcon } from './SidePanelIcons'

type EntryDeleteModalProps = {
  entryDeleteTarget: EntryDeleteState | null
  onClose: () => void
  onConfirm: () => void
  t: I18nValue['t']
}

export function EntryDeleteModal({ entryDeleteTarget, onClose, onConfirm, t }: EntryDeleteModalProps) {
  if (!entryDeleteTarget) return null

  return (
    <div className="library-modal-backdrop" role="presentation">
      <div className="library-modal panel" role="dialog" aria-modal="true">
        <div className="list-settings-header">
          <div>
            <p className="library-detail-kicker">{t('library.deleteItem')}</p>
            <h3 className="list-settings-title">{t('library.deleteItemConfirmTitle')}</h3>
          </div>
          <button className="list-settings-close" type="button" aria-label={t('common.close')} onClick={onClose}>
            <CloseIcon className="list-settings-close-icon" />
          </button>
        </div>

        <p className="library-detail-copy">{t('library.deleteItemConfirmBody', { title: entryDeleteTarget.title })}</p>
        <div className="library-modal-actions">
          <button className="button secondary" type="button" onClick={onClose}>{t('common.cancel')}</button>
          <button className="button danger" type="button" onClick={onConfirm}>{t('library.confirmDeleteItem')}</button>
        </div>
      </div>
    </div>
  )
}
