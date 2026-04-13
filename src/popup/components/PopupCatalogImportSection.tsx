/** Renders catalog recovery controls for supported source pages without owning import side effects. */
import { CustomSelect } from '../../shared/ui/CustomSelect'
import type { CatalogImportSnapshot } from '../../shared/catalog-import/types'
import type { WatchListDefinition } from '../../shared/types'
import { getLocalizedListDefinitionLabel } from '../../shared/i18n/helpers'
import type { CatalogImportProgressState } from '../popup-types'
import { CREATE_NEW_LIST_OPTION, type PopupTranslate } from '../utils/popup-helpers'

interface PopupCatalogImportSectionProps {
  availableLists: WatchListDefinition[]
  buttonLabel: string
  canRun: boolean
  completedTarget: { listId: string; label: string } | null
  count: number
  duplicateList: WatchListDefinition | null
  hintMessage: string | null
  isBusy: boolean
  isOlympusCatalogPage: boolean
  mergeConfirmed: boolean
  needsNewListName: boolean
  newListLabel: string
  onAction: () => void
  onChangeMergeConfirmed: (checked: boolean) => void
  onChangeNewListLabel: (value: string) => void
  onChangeTarget: (value: string) => void
  onScanOlympus: () => void
  previewItems: Array<{ sourceId: string; title: string }>
  progress: CatalogImportProgressState | null
  scanBusy: boolean
  snapshot: CatalogImportSnapshot | null
  statusMessage: string | null
  t: PopupTranslate
  target: string
}

export function PopupCatalogImportSection({
  availableLists,
  buttonLabel,
  canRun,
  completedTarget,
  count,
  duplicateList,
  hintMessage,
  isBusy,
  isOlympusCatalogPage,
  mergeConfirmed,
  needsNewListName,
  newListLabel,
  onAction,
  onChangeMergeConfirmed,
  onChangeNewListLabel,
  onChangeTarget,
  onScanOlympus,
  previewItems,
  progress,
  scanBusy,
  snapshot,
  statusMessage,
  t,
  target,
}: PopupCatalogImportSectionProps) {
  if (!snapshot && !isOlympusCatalogPage) {
    return null
  }

  return (
    <section className="popup-hero popup-import-section">
      <div className="popup-heading-row">
        <div>
          <p className="eyebrow">{t('popup.catalogImportKicker')}</p>
          <h2 className="section-title popup-import-title">{t('popup.catalogImportTitle')}</h2>
        </div>
        <span className="section-chip">{snapshot ? count : t('popup.noSignal')}</span>
      </div>

      <div className="catalog-import-card">
        {!snapshot && isOlympusCatalogPage ? (
          <div className="catalog-import-scan-callout">
            <strong className="catalog-import-list-label">Olympus Biblioteca</strong>
            <p className="tiny catalog-import-hint">{t('popup.catalogImportScanHint')}</p>
            <div className="popup-footer popup-primary-actions">
              <button className="button" type="button" disabled={scanBusy} onClick={onScanOlympus}>
                {scanBusy ? t('popup.reanalyzing') : t('popup.catalogImportScanAction')}
              </button>
            </div>
          </div>
        ) : null}

        {snapshot ? (
          <>
            <div className="catalog-import-copy">
              <strong className="catalog-import-list-label">{snapshot.listLabel}</strong>
              <p className="muted popup-message">{statusMessage}</p>
              <p className="tiny catalog-import-hint">{hintMessage}</p>
            </div>

            <div className="popup-section">
              <label className="label popup-compact-label">{t('popup.catalogImportTargetLabel')}</label>
              <CustomSelect
                value={target}
                disabled={isBusy}
                onChange={onChangeTarget}
                options={[
                  {
                    value: CREATE_NEW_LIST_OPTION,
                    label: t('popup.catalogImportCreateOption'),
                  },
                  ...availableLists.map((list) => ({
                    value: list.id,
                    label: getLocalizedListDefinitionLabel(list, t),
                  })),
                ]}
              />
            </div>

            {needsNewListName ? (
              <div className="popup-section">
                <label className="label popup-compact-label" htmlFor="catalog-import-new-list">
                  {t('popup.catalogImportNewListLabel')}
                </label>
                <input
                  id="catalog-import-new-list"
                  className="field"
                  value={newListLabel}
                  disabled={isBusy}
                  placeholder={t('popup.catalogImportNewListPlaceholder')}
                  onChange={(event) => onChangeNewListLabel(event.target.value)}
                />
              </div>
            ) : null}

            {duplicateList ? (
              <label className="catalog-import-confirm">
                <input
                  type="checkbox"
                  checked={mergeConfirmed}
                  disabled={isBusy}
                  onChange={(event) => onChangeMergeConfirmed(event.target.checked)}
                />
                <span>{t('popup.catalogImportConfirmMerge')}</span>
              </label>
            ) : null}

            {previewItems.length > 0 ? (
              <div className="catalog-import-preview">
                {previewItems.map((item) => (
                  <span key={`${item.sourceId}:${item.title}`} className="popup-title-alias-chip">
                    {item.title}
                  </span>
                ))}
                {snapshot.items.length > previewItems.length ? (
                  <span className="popup-title-alias-chip">
                    {t('popup.catalogImportMore', {
                      count: snapshot.items.length - previewItems.length,
                    })}
                  </span>
                ) : null}
              </div>
            ) : null}

            <button
              className="button catalog-import-button"
              type="button"
              disabled={!canRun && !(completedTarget && progress?.stage === 'done')}
              onClick={onAction}
            >
              {buttonLabel}
            </button>
          </>
        ) : null}
      </div>
    </section>
  )
}
