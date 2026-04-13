/** Owns custom list creation, rename, clear, delete, and related drawer/modal local state. */
import { useState, type Dispatch, type SetStateAction } from 'react'
import { addList, clearList, getLibrary, removeList, updateList } from '../../shared/client'
import type { I18nValue } from '../../shared/i18n/context'
import type { WatchLogSnapshot } from '../../shared/types'
import type { LibraryStatusMessageState, ListModalState } from '../types'

type UseListManagementParams = {
  selectedViewId: string
  setSelectedCatalogId: Dispatch<SetStateAction<string | null>>
  setSelectedViewId: Dispatch<SetStateAction<string>>
  setSnapshot: Dispatch<SetStateAction<WatchLogSnapshot>>
  setStatusMessageState: Dispatch<SetStateAction<LibraryStatusMessageState>>
  snapshot: WatchLogSnapshot
  t: I18nValue['t']
}

export function useListManagement({
  selectedViewId,
  setSelectedCatalogId,
  setSelectedViewId,
  setSnapshot,
  setStatusMessageState,
  snapshot,
  t,
}: UseListManagementParams) {
  const [newListLabel, setNewListLabel] = useState('')
  const [activeListSettingsId, setActiveListSettingsId] = useState<string | null>(null)
  const [listNameDraft, setListNameDraft] = useState('')
  const [listModalState, setListModalState] = useState<ListModalState | null>(null)

  const queueLists = snapshot.lists.filter((list) => !['watching', 'completed'].includes(list.id))
  const activeListSettings = queueLists.find((list) => list.id === activeListSettingsId) ?? null

  async function handleAddList(): Promise<void> {
    if (!newListLabel.trim()) return

    try {
      const response = await addList(newListLabel.trim())
      const libraryResponse = await getLibrary()
      setSnapshot(libraryResponse.snapshot)
      setSelectedViewId(response.list.id)
      setSelectedCatalogId(null)
      setNewListLabel('')
      setStatusMessageState({ key: 'library.listCreated', params: { label: response.list.label } })
    } catch (error) {
      console.error('[WatchLog] handleAddList:error', error)
      setStatusMessageState({
        key: 'library.errorWithReason',
        params: { reason: error instanceof Error ? error.message : t('library.listCreateFailed') },
      })
    }
  }

  function handleOpenListSettings(listId: string, label: string): void {
    setSelectedCatalogId(null)
    setActiveListSettingsId(listId)
    setListNameDraft(label)
    setListModalState(null)
  }

  async function handleSaveListName(): Promise<void> {
    if (!activeListSettings || activeListSettings.kind !== 'custom') return

    try {
      const response = await updateList(activeListSettings.id, listNameDraft)
      setSnapshot(response.snapshot)
      setListNameDraft(response.list.label)
      setStatusMessageState({ key: 'library.listUpdated', params: { label: response.list.label } })
    } catch (error) {
      setStatusMessageState({
        key: 'library.errorWithReason',
        params: { reason: error instanceof Error ? error.message : t('library.listCreateFailed') },
      })
    }
  }

  async function handleConfirmListModal(): Promise<void> {
    if (!listModalState) return
    if (listModalState.mode === 'clear') {
      try {
        const response = await clearList(listModalState.listId)
        setSnapshot(response.snapshot)
        setSelectedCatalogId(null)
        setListModalState(null)
        setStatusMessageState({ key: 'library.listCleared', params: { label: listModalState.label } })
      } catch (error) {
        setStatusMessageState({
          key: 'library.errorWithReason',
          params: { reason: error instanceof Error ? error.message : 'clear-list-failed' },
        })
      }
      return
    }

    if (listModalState.input.trim() !== listModalState.label) {
      setStatusMessageState({ key: 'library.errorWithReason', params: { reason: t('library.deleteListTypeName') } })
      return
    }

    try {
      const response = await removeList(listModalState.listId)
      setSnapshot(response.snapshot)
      setSelectedCatalogId(null)
      if (selectedViewId === listModalState.listId) {
        setSelectedViewId(response.fallbackListId)
      }
      setActiveListSettingsId(null)
      setListNameDraft('')
      setListModalState(null)
      setStatusMessageState({ key: 'library.listDeleted', params: { label: listModalState.label } })
    } catch (error) {
      setStatusMessageState({
        key: 'library.errorWithReason',
        params: { reason: error instanceof Error ? error.message : t('library.listCreateFailed') },
      })
    }
  }

  return {
    activeListSettings,
    activeListSettingsId,
    listModalState,
    listNameDraft,
    newListLabel,
    queueLists,
    setActiveListSettingsId,
    setListModalState,
    setListNameDraft,
    setNewListLabel,
    handleAddList,
    handleConfirmListModal,
    handleOpenListSettings,
    handleSaveListName,
  }
}
