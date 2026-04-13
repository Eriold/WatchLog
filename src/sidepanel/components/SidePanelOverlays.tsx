/** Renders the entry drawer, list drawer, scrim, and sidepanel modals that sit above the main layout. */
import type { I18nValue } from '../../shared/i18n/context'
import type { StructuredProgressControl } from '../../shared/progress'
import type {
  LibraryEntry,
  MetadataCard,
  ProgressState,
  WatchLogSnapshot,
  WatchListDefinition,
} from '../../shared/types'
import { EntryDetailDrawer } from '../EntryDetailDrawer'
import type { CatalogSyncSummary, EntryDeleteState, EntryDraft, ListModalState } from '../types'
import { CatalogSyncSummaryModal } from './CatalogSyncSummaryModal'
import { EntryDeleteModal } from './EntryDeleteModal'
import { ListActionModal } from './ListActionModal'
import { ListSettingsDrawer } from './ListSettingsDrawer'

type SidePanelOverlaysProps = {
  activeListSettings: WatchListDefinition | null
  activeOverlay: string | null
  catalogSyncSummary: CatalogSyncSummary | null
  entryDeleteTarget: EntryDeleteState | null
  isEntryAniListRefreshing: boolean
  itemCount: number
  listModalState: ListModalState | null
  listNameDraft: string
  locale: I18nValue['locale']
  onCloseEntryDelete: () => void
  onCloseListModal: () => void
  onCloseListSettings: () => void
  onCloseOverlay: () => void
  onCloseSyncSummary: () => void
  onConfirmDeleteEntry: () => void
  onConfirmListModal: () => void
  onDeleteEntry: () => void
  onEntryAniListRefresh: () => void
  onExplorerSave: (item: MetadataCard, listId: string) => void
  onExplorerSaveListChange: (listId: string) => void
  onInputListModal: (value: string) => void
  onListNameDraftChange: (value: string) => void
  onOpenExistingExplorerEntry: (entry: LibraryEntry) => void
  onRequestClearList: () => void
  onRequestDeleteList: () => void
  onSaveEntry: () => void
  onSaveListName: () => void
  onToggleFavorite: () => void
  onUpdateDraft: (patch: Partial<EntryDraft>) => void
  selectedDraft: EntryDraft | null
  selectedEntry: LibraryEntry | null
  selectedEntryDetails: Pick<MetadataCard, 'genres' | 'publicationStatus' | 'startDate' | 'endDate' | 'sourceUrl'> | null
  selectedEntryDisplayProgress: ProgressState | null
  selectedEntryProgressControl: StructuredProgressControl | null
  selectedEntryProgressPercent: number
  selectedEntryProgressSelectValue: string
  selectedExplorerItem: MetadataCard | null
  selectedExplorerMatch: LibraryEntry | null
  selectedExplorerSaveListId: string
  snapshot: WatchLogSnapshot
  t: I18nValue['t']
}

export function SidePanelOverlays(props: SidePanelOverlaysProps) {
  return (
    <>
      <EntryDetailDrawer
        locale={props.locale}
        snapshot={props.snapshot}
        t={props.t}
        selectedEntry={props.selectedEntry}
        selectedDraft={props.selectedDraft}
        selectedExplorerItem={props.selectedExplorerItem}
        selectedExplorerMatch={props.selectedExplorerMatch}
        selectedEntryDisplayProgress={props.selectedEntryDisplayProgress}
        selectedEntryProgressControl={props.selectedEntryProgressControl}
        selectedEntryProgressPercent={props.selectedEntryProgressPercent}
        selectedEntryProgressSelectValue={props.selectedEntryProgressSelectValue}
        selectedEntryDetails={props.selectedEntryDetails}
        isEntryAniListRefreshing={props.isEntryAniListRefreshing}
        selectedExplorerSaveListId={props.selectedExplorerSaveListId}
        onUpdateDraft={props.onUpdateDraft}
        onToggleFavorite={props.onToggleFavorite}
        onSaveEntry={props.onSaveEntry}
        onRefreshEntryAniList={props.onEntryAniListRefresh}
        onCloseSelectedEntry={props.onCloseOverlay}
        onCloseSelectedExplorer={props.onCloseOverlay}
        onDeleteEntry={props.onDeleteEntry}
        onOpenExistingExplorerEntry={props.onOpenExistingExplorerEntry}
        onExplorerSaveListChange={props.onExplorerSaveListChange}
        onExplorerSave={props.onExplorerSave}
      />

      <div className={`list-settings-scrim ${props.activeOverlay ? 'is-visible' : ''}`} aria-hidden="true" onClick={props.onCloseOverlay} />
      <ListSettingsDrawer
        activeListSettings={props.activeListSettings}
        itemCount={props.itemCount}
        listNameDraft={props.listNameDraft}
        locale={props.locale}
        onClose={props.onCloseListSettings}
        onListNameDraftChange={props.onListNameDraftChange}
        onRequestClearList={props.onRequestClearList}
        onRequestDeleteList={props.onRequestDeleteList}
        onSaveListName={props.onSaveListName}
        t={props.t}
      />
      <ListActionModal
        listModalState={props.listModalState}
        onClose={props.onCloseListModal}
        onConfirm={props.onConfirmListModal}
        onInputChange={props.onInputListModal}
        t={props.t}
      />
      <EntryDeleteModal
        entryDeleteTarget={props.entryDeleteTarget}
        onClose={props.onCloseEntryDelete}
        onConfirm={props.onConfirmDeleteEntry}
        t={props.t}
      />
      <CatalogSyncSummaryModal
        catalogSyncSummary={props.catalogSyncSummary}
        onClose={props.onCloseSyncSummary}
        t={props.t}
      />
    </>
  )
}
