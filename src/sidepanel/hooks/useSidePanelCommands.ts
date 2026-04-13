/** Coordinates cross-cutting sidepanel interactions between selection state, list drawer, and explorer context. */
import type { FormEvent } from 'react'
import { EXPLORER_TAB_ID } from '../../shared/constants'
import type { LibraryEntry } from '../../shared/types'
import type { ListModalState } from '../types'

type UseSidePanelCommandsParams = {
  activeListSettings:
    | {
      id: string
      kind: string
      label: string
    }
    | null
  explorerMatchedEntries: Map<string, LibraryEntry | null>
  getDefaultExplorerSaveListId: () => string
  handleExplorerSearch: () => Promise<void>
  setActiveListSettingsId: (value: string | null) => void
  setListModalState: (value: ListModalState | null) => void
  setSelectedCatalogId: (value: string | null) => void
  setSelectedExplorerId: (value: string | null) => void
  setSelectedExplorerSaveListId: (value: string) => void
  setSelectedViewId: (value: string) => void
}

export function useSidePanelCommands({
  activeListSettings,
  explorerMatchedEntries,
  getDefaultExplorerSaveListId,
  handleExplorerSearch,
  setActiveListSettingsId,
  setListModalState,
  setSelectedCatalogId,
  setSelectedExplorerId,
  setSelectedExplorerSaveListId,
  setSelectedViewId,
}: UseSidePanelCommandsParams) {
  function handleSelectEntry(catalogId: string): void {
    setActiveListSettingsId(null)
    setSelectedExplorerId(null)
    setSelectedCatalogId(catalogId)
  }

  function handleSelectExplorerItem(itemId: string): void {
    setActiveListSettingsId(null)
    setSelectedCatalogId(null)
    setSelectedExplorerId(itemId)
    setSelectedExplorerSaveListId(
      explorerMatchedEntries.get(itemId)?.activity.status ?? getDefaultExplorerSaveListId(),
    )
  }

  function handleSelectView(viewId: string): void {
    setActiveListSettingsId(null)
    setSelectedCatalogId(null)
    setSelectedExplorerId(null)
    setSelectedViewId(viewId)
  }

  function handleTopbarSearchSubmit(selectedViewId: string, event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    if (selectedViewId === EXPLORER_TAB_ID) {
      void handleExplorerSearch()
    }
  }

  function closeOverlay(): void {
    setActiveListSettingsId(null)
    setSelectedCatalogId(null)
    setSelectedExplorerId(null)
  }

  function handleRequestClearList(): void {
    if (!activeListSettings) return
    setListModalState({ mode: 'clear', listId: activeListSettings.id, label: activeListSettings.label, input: '' })
  }

  function handleRequestDeleteList(): void {
    if (!activeListSettings || activeListSettings.kind !== 'custom') return
    setListModalState({ mode: 'delete', listId: activeListSettings.id, label: activeListSettings.label, input: '' })
  }

  function handleListModalInput(value: string, listModalState: ListModalState | null): void {
    if (listModalState) {
      setListModalState({ ...listModalState, input: value })
    }
  }

  return {
    closeOverlay,
    handleListModalInput,
    handleRequestClearList,
    handleRequestDeleteList,
    handleSelectEntry,
    handleSelectExplorerItem,
    handleSelectView,
    handleTopbarSearchSubmit,
  }
}
