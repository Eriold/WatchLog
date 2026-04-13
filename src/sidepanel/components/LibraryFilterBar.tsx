/** Renders filter chips, sort selector, sync action, and visible-count status for the current view. */
import { EXPLORER_TAB_ID } from '../../shared/constants'
import { getLocalizedMediaTypeLabel } from '../../shared/i18n/helpers'
import type { I18nValue } from '../../shared/i18n/context'
import type { LibraryEntry } from '../../shared/types'
import { CustomSelect } from '../../shared/ui/CustomSelect'

type LibraryFilterBarProps = {
  catalogSyncButtonLabel: string
  explorerCount: number
  filteredCount: number
  isCatalogSyncRunning: boolean
  onSortByChange: (value: string) => void
  onSourceFilterChange: (value: string) => void
  onSyncPendingCatalog: () => void
  onTypeFilterChange: (value: string) => void
  pendingCount: number
  selectedViewId: string
  sortBy: string
  sourceFilter: string
  sourceOptions: string[]
  t: I18nValue['t']
  title: string
  typeFilter: string
  typeOptions: string[]
}

export function LibraryFilterBar({
  catalogSyncButtonLabel,
  explorerCount,
  filteredCount,
  isCatalogSyncRunning,
  onSortByChange,
  onSourceFilterChange,
  onSyncPendingCatalog,
  onTypeFilterChange,
  pendingCount,
  selectedViewId,
  sortBy,
  sourceFilter,
  sourceOptions,
  t,
  title,
  typeFilter,
  typeOptions,
}: LibraryFilterBarProps) {
  const isExplorer = selectedViewId === EXPLORER_TAB_ID

  return (
    <section className="library-filter-bar">
      <div className="library-filter-group">
        <span className="library-filter-chip is-static">{title}</span>
        {!isExplorer ? (
          <>
            <label className="library-filter-chip">
              <CustomSelect
                value={typeFilter}
                onChange={onTypeFilterChange}
                options={[
                  { value: 'all', label: t('library.typeAll') },
                  ...typeOptions.map((mediaType) => ({
                    value: mediaType,
                    label: `${t('library.typePrefix')}: ${getLocalizedMediaTypeLabel(mediaType as LibraryEntry['catalog']['mediaType'], t)}`,
                  })),
                ]}
              />
            </label>
            <label className="library-filter-chip">
              <CustomSelect
                value={sourceFilter}
                onChange={onSourceFilterChange}
                options={[
                  { value: 'all', label: t('library.platformAny') },
                  ...sourceOptions.map((source) => ({
                    value: source,
                    label: `${t('library.platformPrefix')}: ${source === 'Unknown' ? t('common.unknown') : source}`,
                  })),
                ]}
              />
            </label>
          </>
        ) : null}
      </div>

      <div className="library-filter-group">
        {!isExplorer ? (
          <label className="library-filter-chip">
            <CustomSelect
              value={sortBy}
              onChange={onSortByChange}
              options={[
                { value: 'recent', label: t('library.sortRecents') },
                { value: 'title', label: t('library.sortTitle') },
                { value: 'progress', label: t('library.sortProgress') },
              ]}
            />
          </label>
        ) : null}
        {!isExplorer ? (
          <button
            className="button secondary library-sync-button"
            type="button"
            disabled={isCatalogSyncRunning || pendingCount === 0}
            onClick={onSyncPendingCatalog}
          >
            {catalogSyncButtonLabel}
          </button>
        ) : null}
        <span className="library-status-chip">
          {isExplorer
            ? t(explorerCount === 1 ? 'library.explorerCards.one' : 'library.explorerCards.other', { count: explorerCount })
            : t(filteredCount === 1 ? 'library.visibleItems.one' : 'library.visibleItems.other', { count: filteredCount })}
        </span>
      </div>
    </section>
  )
}
