/** Composes the sidepanel from focused hooks and presentational components instead of a monolithic screen file. */
import { useState } from 'react'
import type { MetadataCard } from '../shared/types'
import { useI18n } from '../shared/i18n/useI18n'
import { LibrarySidebar } from './components/LibrarySidebar'
import { SidePanelMainContent } from './components/SidePanelMainContent'
import { SidePanelOverlays } from './components/SidePanelOverlays'
import { useCatalogSync } from './hooks/useCatalogSync'
import { useEntryActions } from './hooks/useEntryActions'
import { useEntryDrafts } from './hooks/useEntryDrafts'
import { useExplorerActions } from './hooks/useExplorerActions'
import { useLibraryBootstrap } from './hooks/useLibraryBootstrap'
import { useLibrarySelectionState } from './hooks/useLibrarySelectionState'
import { useLibraryViewModel } from './hooks/useLibraryViewModel'
import { useListManagement } from './hooks/useListManagement'
import { useSelectedEntryMetadata } from './hooks/useSelectedEntryMetadata'
import { useSidePanelCommands } from './hooks/useSidePanelCommands'
import './sidepanel.css'
import type { LibraryStatusMessageState } from './types'
import { getListEntryCount } from './utils/library-helpers'
import { getViewCount, getViewDescription, getViewTitle, getInitialSnapshot } from './utils/view-helpers'
export function SidePanelApp() {
  const { locale, t } = useI18n()
  const [snapshot, setSnapshot] = useState(getInitialSnapshot)
  const [explorerItems, setExplorerItems] = useState<MetadataCard[]>([])
  const [statusMessageState, setStatusMessageState] = useState<LibraryStatusMessageState>({ key: 'library.loading' })
  const selection = useLibrarySelectionState()
  const { drafts, setDrafts } = useEntryDrafts()
  useLibraryBootstrap({ setExplorerItems, setSnapshot, setStatusMessageState, t })
  const lists = useListManagement({
    selectedViewId: selection.selectedViewId,
    setSelectedCatalogId: selection.setSelectedCatalogId,
    setSelectedViewId: selection.setSelectedViewId,
    setSnapshot,
    setStatusMessageState,
    snapshot,
    t,
  })
  const view = useLibraryViewModel({
    drafts,
    explorerItems,
    libraryQuery: selection.libraryQuery,
    selectedCatalogId: selection.selectedCatalogId,
    selectedExplorerId: selection.selectedExplorerId,
    selectedExplorerSaveListId: selection.selectedExplorerSaveListId,
    selectedViewId: selection.selectedViewId,
    snapshot,
    sortBy: selection.sortBy,
    sourceFilter: selection.sourceFilter,
    t,
    typeFilter: selection.typeFilter,
  })
  const { selectedEntryMetadata, setSelectedEntryMetadata } = useSelectedEntryMetadata(view.selectedEntry)
  const entryActions = useEntryActions({
    selectedCatalogId: selection.selectedCatalogId,
    selectedDraft: view.selectedDraft,
    selectedEntry: view.selectedEntry,
    setDrafts,
    setSelectedCatalogId: selection.setSelectedCatalogId,
    setSelectedEntryMetadata,
    setSnapshot,
    setStatusMessageState,
    t,
  })
  const explorerActions = useExplorerActions({
    explorerQuery: selection.explorerQuery,
    setExplorerItems,
    setSelectedCatalogId: selection.setSelectedCatalogId,
    setSelectedExplorerId: selection.setSelectedExplorerId,
    setSelectedExplorerSaveListId: selection.setSelectedExplorerSaveListId,
    setSelectedViewId: selection.setSelectedViewId,
    setSnapshot,
    setStatusMessageState,
    t,
  })
  const sync = useCatalogSync({ pendingEntries: view.pendingEntries, setSnapshot, t })
  const commands = useSidePanelCommands({
    activeListSettings: lists.activeListSettings,
    explorerMatchedEntries: view.explorerMatchedEntries,
    getDefaultExplorerSaveListId: view.getDefaultExplorerSaveListId,
    handleExplorerSearch: explorerActions.handleExplorerSearch,
    setActiveListSettingsId: lists.setActiveListSettingsId,
    setListModalState: lists.setListModalState,
    setSelectedCatalogId: selection.setSelectedCatalogId,
    setSelectedExplorerId: selection.setSelectedExplorerId,
    setSelectedExplorerSaveListId: selection.setSelectedExplorerSaveListId,
    setSelectedViewId: selection.setSelectedViewId,
  })
  const selectedEntryDetails = selectedEntryMetadata ?? view.selectedEntry?.catalog ?? null
  const activeOverlay = lists.activeListSettings || view.selectedEntry || view.selectedExplorerItem ? 'drawer' : null
  const statusMessage = t(statusMessageState.key, statusMessageState.params)
  const showTopbarError = statusMessageState.key === 'library.errorWithReason'
  const catalogSyncButtonLabel =
    sync.catalogSyncProgress !== null
      ? t('library.syncPendingRunning', sync.catalogSyncProgress)
      : view.pendingEntries.length > 0
        ? t('library.syncPendingAction', { count: view.pendingEntries.length })
        : t('library.syncPendingNone')
  return (
    <div className="sidepanel-shell library-shell">
      <LibrarySidebar
        newListLabel={lists.newListLabel}
        onListLabelChange={lists.setNewListLabel}
        onOpenListSettings={lists.handleOpenListSettings}
        onSelectView={commands.handleSelectView}
        onSubmitNewList={() => void lists.handleAddList()}
        primaryViews={view.primaryViews}
        queueLists={lists.queueLists}
        selectedViewId={selection.selectedViewId}
        t={t}
        getListEntryCount={(listId) => getListEntryCount(listId, view.entries)}
        getViewCount={(viewId) => getViewCount(viewId, view.entries, explorerItems)}
      />
      <SidePanelMainContent
        catalogSyncButtonLabel={catalogSyncButtonLabel}
        explorerItems={explorerItems}
        explorerMatchedEntries={view.explorerMatchedEntries}
        filteredEntries={view.filteredEntries}
        isCatalogSyncRunning={sync.catalogSyncProgress !== null}
        libraryQuery={selection.libraryQuery}
        locale={locale}
        onExplorerAdd={(item, listId) => void explorerActions.handleExplorerAdd(item, listId)}
        onExplorerQueryChange={selection.setExplorerQuery}
        onLibraryQueryChange={selection.setLibraryQuery}
        onOpenExistingExplorerEntry={explorerActions.handleOpenExistingExplorerEntry}
        onSearchSubmit={(event) => commands.handleTopbarSearchSubmit(selection.selectedViewId, event)}
        onSelectEntry={commands.handleSelectEntry}
        onSelectExplorerItem={commands.handleSelectExplorerItem}
        onSortByChange={selection.setSortBy}
        onSourceFilterChange={selection.setSourceFilter}
        onSyncPendingCatalog={() => void sync.handleSyncPendingCatalog()}
        onTypeFilterChange={selection.setTypeFilter}
        pendingCount={view.pendingEntries.length}
        selectedCatalogId={selection.selectedCatalogId}
        selectedExplorerIsSavedInSelectedList={view.selectedExplorerIsSavedInSelectedList}
        selectedExplorerItem={view.selectedExplorerItem}
        selectedExplorerMatch={view.selectedExplorerMatch}
        selectedExplorerSaveListId={selection.selectedExplorerSaveListId}
        selectedViewId={selection.selectedViewId}
        showTopbarError={showTopbarError}
        sortBy={selection.sortBy}
        sourceFilter={selection.sourceFilter}
        sourceOptions={view.sourceOptions}
        statusMessage={statusMessage}
        subtitle={getViewDescription(selection.selectedViewId, t)}
        syncSet={new Set(sync.syncingCatalogIds)}
        snapshot={snapshot}
        t={t}
        title={getViewTitle(selection.selectedViewId, snapshot, t)}
        typeFilter={selection.typeFilter}
        typeOptions={view.typeOptions}
        visibleDefaultListId={view.getDefaultExplorerSaveListId()}
        explorerQuery={selection.explorerQuery}
      />
      <SidePanelOverlays
        activeListSettings={lists.activeListSettings}
        activeOverlay={activeOverlay}
        catalogSyncSummary={sync.catalogSyncSummary}
        entryDeleteTarget={entryActions.entryDeleteTarget}
        isEntryAniListRefreshing={entryActions.isEntryAniListRefreshing}
        itemCount={lists.activeListSettings ? getListEntryCount(lists.activeListSettings.id, view.entries) : 0}
        listModalState={lists.listModalState}
        listNameDraft={lists.listNameDraft}
        locale={locale}
        onCloseEntryDelete={() => entryActions.setEntryDeleteTarget(null)}
        onCloseListModal={() => lists.setListModalState(null)}
        onCloseListSettings={() => lists.setActiveListSettingsId(null)}
        onCloseOverlay={commands.closeOverlay}
        onCloseSyncSummary={() => sync.setCatalogSyncSummary(null)}
        onConfirmDeleteEntry={() => void entryActions.handleConfirmDeleteEntry()}
        onConfirmListModal={() => void lists.handleConfirmListModal()}
        onDeleteEntry={entryActions.handleRequestDeleteEntry}
        onEntryAniListRefresh={entryActions.handleRefreshEntryAniList}
        onExplorerSave={(item, listId) => void explorerActions.handleExplorerAdd(item, listId)}
        onExplorerSaveListChange={selection.setSelectedExplorerSaveListId}
        onInputListModal={(value) => commands.handleListModalInput(value, lists.listModalState)}
        onListNameDraftChange={lists.setListNameDraft}
        onOpenExistingExplorerEntry={explorerActions.handleOpenExistingExplorerEntry}
        onRequestClearList={commands.handleRequestClearList}
        onRequestDeleteList={commands.handleRequestDeleteList}
        onSaveEntry={entryActions.handleSaveEntry}
        onSaveListName={() => void lists.handleSaveListName()}
        onToggleFavorite={entryActions.handleToggleFavorite}
        onUpdateDraft={entryActions.updateDraft}
        selectedDraft={view.selectedDraft}
        selectedEntry={view.selectedEntry}
        selectedEntryDetails={selectedEntryDetails}
        selectedEntryDisplayProgress={view.selectedEntryDisplayProgress}
        selectedEntryProgressControl={view.selectedEntryProgressControl}
        selectedEntryProgressPercent={view.selectedEntryProgressPercent}
        selectedEntryProgressSelectValue={view.selectedEntryProgressSelectValue}
        selectedExplorerItem={view.selectedExplorerItem}
        selectedExplorerMatch={view.selectedExplorerMatch}
        selectedExplorerSaveListId={selection.selectedExplorerSaveListId}
        snapshot={snapshot}
        t={t}
      />
    </div>
  )
}
