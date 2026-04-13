/** Owns entry draft edits, delete confirmation, favorite toggles, persistence, and manual AniList refresh. */
import { useState, type Dispatch, type SetStateAction } from 'react'
import { removeEntry, updateEntry } from '../../shared/client'
import type { I18nValue } from '../../shared/i18n/context'
import {
  buildProgressStateFromControl,
  getResolvedProgressState,
  getStructuredProgressControl,
} from '../../shared/progress'
import type { LibraryEntry, MetadataCard, WatchLogSnapshot } from '../../shared/types'
import type { EntryDeleteState, EntryDraft, LibraryStatusMessageState } from '../types'
import { useEntryAniListRefresh } from './useEntryAniListRefresh'
import { createEntryDraft, getEntryDisplayProgress } from '../utils/progress-helpers'

type UseEntryActionsParams = {
  selectedCatalogId: string | null
  selectedDraft: EntryDraft | null
  selectedEntry: LibraryEntry | null
  setDrafts: Dispatch<SetStateAction<Record<string, EntryDraft>>>
  setSelectedCatalogId: Dispatch<SetStateAction<string | null>>
  setSelectedEntryMetadata: Dispatch<SetStateAction<MetadataCard | null>>
  setSnapshot: Dispatch<SetStateAction<WatchLogSnapshot>>
  setStatusMessageState: Dispatch<SetStateAction<LibraryStatusMessageState>>
  t: I18nValue['t']
}

export function useEntryActions({
  selectedCatalogId,
  selectedDraft,
  selectedEntry,
  setDrafts,
  setSelectedCatalogId,
  setSelectedEntryMetadata,
  setSnapshot,
  setStatusMessageState,
  t,
}: UseEntryActionsParams) {
  const [entryDeleteTarget, setEntryDeleteTarget] = useState<EntryDeleteState | null>(null)
  const aniListRefresh = useEntryAniListRefresh({
    selectedCatalogId,
    selectedDraft,
    selectedEntry,
    setDrafts,
    setSelectedEntryMetadata,
    setSnapshot,
    setStatusMessageState,
    t,
  })

  function updateDraft(patch: Partial<EntryDraft>): void {
    if (!selectedEntry || !selectedDraft) return
    setDrafts((current) => ({
      ...current,
      [selectedEntry.catalog.id]: { ...selectedDraft, ...patch },
    }))
  }

  async function handleToggleFavorite(): Promise<void> {
    if (!selectedEntry || !selectedDraft) return
    const previousFavorite = selectedDraft.favorite
    const nextFavorite = !previousFavorite

    setDrafts((current) => ({
      ...current,
      [selectedEntry.catalog.id]: { ...selectedDraft, favorite: nextFavorite },
    }))

    try {
      const response = await updateEntry({ catalogId: selectedEntry.catalog.id, favorite: nextFavorite })
      setSnapshot(response.snapshot)
      if (response.entry) {
        const persistedFavorite = response.entry.activity.favorite
        setDrafts((current) => ({
          ...current,
          [selectedEntry.catalog.id]: {
            ...(current[selectedEntry.catalog.id] ?? selectedDraft),
            favorite: persistedFavorite,
          },
        }))
      }
      setStatusMessageState({ key: 'library.entryUpdated' })
    } catch (error) {
      setDrafts((current) => ({
        ...current,
        [selectedEntry.catalog.id]: { ...selectedDraft, favorite: previousFavorite },
      }))
      setStatusMessageState({
        key: 'library.errorWithReason',
        params: { reason: error instanceof Error ? error.message : 'favorite-toggle-failed' },
      })
    }
  }

  async function handleSaveEntry(): Promise<void> {
    if (!selectedEntry || !selectedDraft) return
    const currentProgress = getEntryDisplayProgress(selectedEntry)
    const progressControl = getStructuredProgressControl(currentProgress)
    const nextProgress = progressControl
      ? buildProgressStateFromControl(
        currentProgress,
        selectedDraft.listId,
        progressControl,
        selectedDraft.listId === 'completed'
          ? progressControl.total
          : selectedDraft.progressValue ?? progressControl.current,
      )
      : getResolvedProgressState(
        { ...currentProgress, progressText: selectedDraft.progressText },
        selectedDraft.listId,
        {
          episodeCount: selectedEntry.catalog.episodeCount,
          chapterCount: selectedEntry.catalog.chapterCount,
        },
      )

    const response = await updateEntry({
      catalogId: selectedEntry.catalog.id,
      title: selectedDraft.title,
      mediaType: selectedDraft.mediaType,
      listId: selectedDraft.listId,
      favorite: selectedDraft.favorite,
      manualNotes: selectedDraft.notes,
      progress: nextProgress,
    })

    setSnapshot(response.snapshot)
    const persistedEntry = response.entry
    if (persistedEntry) {
      setDrafts((current) => ({ ...current, [persistedEntry.catalog.id]: createEntryDraft(persistedEntry) }))
    }
    setStatusMessageState({ key: 'library.entryUpdated' })
  }

  function handleRequestDeleteEntry(): void {
    if (selectedEntry) {
      setEntryDeleteTarget({ catalogId: selectedEntry.catalog.id, title: selectedEntry.catalog.title })
    }
  }

  async function handleConfirmDeleteEntry(): Promise<void> {
    if (!entryDeleteTarget) return
    try {
      const response = await removeEntry(entryDeleteTarget.catalogId)
      setSnapshot(response.snapshot)
      setDrafts((current) => {
        const next = { ...current }
        delete next[entryDeleteTarget.catalogId]
        return next
      })
      setSelectedCatalogId(null)
      setEntryDeleteTarget(null)
      setStatusMessageState({ key: 'library.entryDeleted', params: { title: entryDeleteTarget.title } })
    } catch (error) {
      setStatusMessageState({
        key: 'library.errorWithReason',
        params: { reason: error instanceof Error ? error.message : 'remove-entry-failed' },
      })
    }
  }

  return {
    entryDeleteTarget,
    isEntryAniListRefreshing: aniListRefresh.isEntryAniListRefreshing,
    setEntryDeleteTarget,
    handleConfirmDeleteEntry,
    handleRefreshEntryAniList: aniListRefresh.handleRefreshEntryAniList,
    handleRequestDeleteEntry,
    handleSaveEntry,
    handleToggleFavorite,
    updateDraft,
  }
}
