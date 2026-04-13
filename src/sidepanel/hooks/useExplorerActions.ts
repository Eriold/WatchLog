/** Encapsulates explorer search/add/open actions so the main app only coordinates selected items. */
import type { Dispatch, SetStateAction } from 'react'
import { addFromExplorer, getExplorer } from '../../shared/client'
import { getLocalizedListLabel } from '../../shared/i18n/helpers'
import type { I18nValue } from '../../shared/i18n/context'
import type { LibraryEntry, MetadataCard, WatchLogSnapshot } from '../../shared/types'
import type { LibraryStatusMessageState } from '../types'

type UseExplorerActionsParams = {
  explorerQuery: string
  setExplorerItems: Dispatch<SetStateAction<MetadataCard[]>>
  setSelectedCatalogId: Dispatch<SetStateAction<string | null>>
  setSelectedExplorerId: Dispatch<SetStateAction<string | null>>
  setSelectedExplorerSaveListId: Dispatch<SetStateAction<string>>
  setSelectedViewId: Dispatch<SetStateAction<string>>
  setSnapshot: Dispatch<SetStateAction<WatchLogSnapshot>>
  setStatusMessageState: Dispatch<SetStateAction<LibraryStatusMessageState>>
  t: I18nValue['t']
}

export function useExplorerActions({
  explorerQuery,
  setExplorerItems,
  setSelectedCatalogId,
  setSelectedExplorerId,
  setSelectedExplorerSaveListId,
  setSelectedViewId,
  setSnapshot,
  setStatusMessageState,
  t,
}: UseExplorerActionsParams) {
  async function handleExplorerSearch(): Promise<void> {
    const response = await getExplorer(explorerQuery)
    setExplorerItems(response.items)
    setStatusMessageState({ key: 'library.explorerRefreshed' })
  }

  async function handleExplorerAdd(item: MetadataCard, listId: string): Promise<void> {
    const response = await addFromExplorer(item.id, listId)
    setSnapshot(response.snapshot)
    setStatusMessageState({
      key: 'library.addedToList',
      params: {
        title: item.title,
        label: getLocalizedListLabel(response.snapshot.lists, listId, t),
      },
    })
  }

  function handleOpenExistingExplorerEntry(entry: LibraryEntry): void {
    setSelectedViewId(entry.activity.status)
    setSelectedExplorerId(null)
    setSelectedExplorerSaveListId(entry.activity.status)
    setSelectedCatalogId(entry.catalog.id)
    setStatusMessageState({ key: 'library.ready' })
  }

  return {
    handleExplorerAdd,
    handleExplorerSearch,
    handleOpenExistingExplorerEntry,
  }
}
