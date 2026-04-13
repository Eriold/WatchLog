/** Renders the main content column: topbar, filter bar, explorer results, library grid, or empty state. */
import type { FormEvent } from 'react'
import { EXPLORER_TAB_ID } from '../../shared/constants'
import type { I18nValue } from '../../shared/i18n/context'
import type { LibraryEntry, MetadataCard, WatchLogSnapshot } from '../../shared/types'
import { ExplorerGrid } from './ExplorerGrid'
import { LibraryFilterBar } from './LibraryFilterBar'
import { LibraryGrid } from './LibraryGrid'
import { LibraryTopbar } from './LibraryTopbar'

type SidePanelMainContentProps = {
  catalogSyncButtonLabel: string
  explorerQuery: string
  explorerItems: MetadataCard[]
  explorerMatchedEntries: Map<string, LibraryEntry | null>
  filteredEntries: LibraryEntry[]
  isCatalogSyncRunning: boolean
  libraryQuery: string
  locale: I18nValue['locale']
  onExplorerAdd: (item: MetadataCard, listId: string) => void
  onExplorerQueryChange: (value: string) => void
  onLibraryQueryChange: (value: string) => void
  onOpenExistingExplorerEntry: (entry: LibraryEntry) => void
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void
  onSelectEntry: (catalogId: string) => void
  onSelectExplorerItem: (itemId: string) => void
  onSortByChange: (value: string) => void
  onSourceFilterChange: (value: string) => void
  onSyncPendingCatalog: () => void
  onTypeFilterChange: (value: string) => void
  pendingCount: number
  selectedCatalogId: string | null
  selectedExplorerIsSavedInSelectedList: boolean
  selectedExplorerItem: MetadataCard | null
  selectedExplorerMatch: LibraryEntry | null
  selectedExplorerSaveListId: string
  selectedViewId: string
  showTopbarError: boolean
  sortBy: string
  sourceFilter: string
  sourceOptions: string[]
  statusMessage: string
  subtitle: string
  syncSet: Set<string>
  t: I18nValue['t']
  title: string
  typeFilter: string
  typeOptions: string[]
  visibleDefaultListId: string
  snapshot: WatchLogSnapshot
}

export function SidePanelMainContent(props: SidePanelMainContentProps) {
  const isExplorer = props.selectedViewId === EXPLORER_TAB_ID

  return (
    <div className="library-main">
      <LibraryTopbar
        explorerQuery={props.explorerQuery}
        libraryQuery={props.libraryQuery}
        onExplorerQueryChange={props.onExplorerQueryChange}
        onLibraryQueryChange={props.onLibraryQueryChange}
        onSearchSubmit={props.onSearchSubmit}
        selectedViewId={props.selectedViewId}
        showTopbarError={props.showTopbarError}
        statusMessage={props.statusMessage}
        subtitle={props.subtitle}
        t={props.t}
      />

      <main className="library-content">
        <LibraryFilterBar
          catalogSyncButtonLabel={props.catalogSyncButtonLabel}
          explorerCount={props.explorerItems.length}
          filteredCount={props.filteredEntries.length}
          isCatalogSyncRunning={props.isCatalogSyncRunning}
          onSortByChange={props.onSortByChange}
          onSourceFilterChange={props.onSourceFilterChange}
          onSyncPendingCatalog={props.onSyncPendingCatalog}
          onTypeFilterChange={props.onTypeFilterChange}
          pendingCount={props.pendingCount}
          selectedViewId={props.selectedViewId}
          sortBy={props.sortBy}
          sourceFilter={props.sourceFilter}
          sourceOptions={props.sourceOptions}
          t={props.t}
          title={props.title}
          typeFilter={props.typeFilter}
          typeOptions={props.typeOptions}
        />

        {isExplorer ? (
          <ExplorerGrid
            defaultSaveListId={props.visibleDefaultListId}
            explorerItems={props.explorerItems}
            explorerMatchedEntries={props.explorerMatchedEntries}
            locale={props.locale}
            onExplorerAdd={props.onExplorerAdd}
            onOpenExistingExplorerEntry={props.onOpenExistingExplorerEntry}
            onSelectExplorerItem={props.onSelectExplorerItem}
            selectedExplorerIsSavedInSelectedList={props.selectedExplorerIsSavedInSelectedList}
            selectedExplorerItem={props.selectedExplorerItem}
            selectedExplorerMatch={props.selectedExplorerMatch}
            selectedExplorerSaveListId={props.selectedExplorerSaveListId}
            snapshot={props.snapshot}
            t={props.t}
          />
        ) : props.filteredEntries.length === 0 ? (
          <section className="library-empty-state panel">
            <h3>{props.t('library.noTitlesMatched')}</h3>
            <p>{props.t('library.noTitlesHint')}</p>
          </section>
        ) : (
          <LibraryGrid
            filteredEntries={props.filteredEntries}
            onSelectEntry={props.onSelectEntry}
            selectedCatalogId={props.selectedCatalogId}
            snapshot={props.snapshot}
            syncingCatalogIdSet={props.syncSet}
            t={props.t}
          />
        )}
      </main>
    </div>
  )
}
