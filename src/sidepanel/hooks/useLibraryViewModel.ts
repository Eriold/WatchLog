/** Derives filtered entries, selected records, visible counts, and card-ready values from app state. */
import { EXPLORER_TAB_ID } from '../../shared/constants'
import { getProgressPercentForState, getStructuredProgressControl } from '../../shared/progress'
import { findMatchingLibraryEntryForMetadata, toLibraryEntries } from '../../shared/selectors'
import type { I18nValue } from '../../shared/i18n/context'
import type { MetadataCard, WatchLogSnapshot } from '../../shared/types'
import { ALL_TITLES_VIEW_ID, FAVORITES_VIEW_ID } from '../constants'
import type { EntryDraft } from '../types'
import { getCatalogSyncState } from '../utils/catalog-sync'
import { getDefaultExplorerSaveListId } from '../utils/library-helpers'
import { createEntryDraft, getDraftProgressState, getProgressPercent } from '../utils/progress-helpers'

type UseLibraryViewModelParams = {
  drafts: Record<string, EntryDraft>
  explorerItems: MetadataCard[]
  libraryQuery: string
  selectedCatalogId: string | null
  selectedExplorerId: string | null
  selectedExplorerSaveListId: string
  selectedViewId: string
  snapshot: WatchLogSnapshot
  sortBy: string
  sourceFilter: string
  t: I18nValue['t']
  typeFilter: string
}

export function useLibraryViewModel({
  drafts,
  explorerItems,
  libraryQuery,
  selectedCatalogId,
  selectedExplorerId,
  selectedExplorerSaveListId,
  selectedViewId,
  snapshot,
  sortBy,
  sourceFilter,
  t,
  typeFilter,
}: UseLibraryViewModelParams) {
  const entries = toLibraryEntries(snapshot)
  const primaryViews = [
    { id: ALL_TITLES_VIEW_ID, label: t('views.allTitles'), icon: 'library' as const },
    { id: 'watching', label: t('lists.watching'), icon: 'watching' as const },
    { id: 'completed', label: t('lists.completed'), icon: 'completed' as const },
    { id: FAVORITES_VIEW_ID, label: t('views.favorites'), icon: 'favorites' as const },
    { id: EXPLORER_TAB_ID, label: t('views.explorer'), icon: 'explorer' as const },
  ]

  const baseEntries = entries.filter((entry) => {
    if (selectedViewId === ALL_TITLES_VIEW_ID) return true
    if (selectedViewId === FAVORITES_VIEW_ID) return entry.activity.favorite
    if (selectedViewId === EXPLORER_TAB_ID) return false
    return entry.activity.status === selectedViewId
  })

  const filteredEntries = baseEntries
    .filter((entry) => {
      const normalizedQuery = libraryQuery.toLowerCase()
      const matchesQuery =
        !normalizedQuery ||
        entry.catalog.title.toLowerCase().includes(normalizedQuery) ||
        (entry.catalog.aliases ?? []).some((alias) => alias.toLowerCase().includes(normalizedQuery)) ||
        entry.catalog.genres.some((genre) => genre.toLowerCase().includes(normalizedQuery)) ||
        (entry.activity.lastSource?.siteName ?? '').toLowerCase().includes(normalizedQuery)
      const matchesType = typeFilter === 'all' || entry.catalog.mediaType === typeFilter
      const matchesSource = sourceFilter === 'all' || (entry.activity.lastSource?.siteName ?? 'Unknown') === sourceFilter
      return matchesQuery && matchesType && matchesSource
    })
    .sort((left, right) => {
      if (sortBy === 'title') return left.catalog.title.localeCompare(right.catalog.title)
      if (sortBy === 'progress') {
        return getProgressPercent(right) - getProgressPercent(left)
      }
      return new Date(right.activity.updatedAt).getTime() - new Date(left.activity.updatedAt).getTime()
    })

  const selectedEntry =
    selectedCatalogId === null
      ? null
      : entries.find(
        (entry) =>
          entry.catalog.id === selectedCatalogId &&
          filteredEntries.some((candidate) => candidate.catalog.id === selectedCatalogId),
      ) ?? null

  const selectedExplorerItem =
    selectedExplorerId === null ? null : explorerItems.find((item) => item.id === selectedExplorerId) ?? null
  const explorerMatchedEntries = new Map(
    explorerItems.map((item) => [item.id, findMatchingLibraryEntryForMetadata(snapshot, item)]),
  )
  const selectedExplorerMatch =
    selectedExplorerItem === null ? null : explorerMatchedEntries.get(selectedExplorerItem.id) ?? null
  const selectedDraft = selectedEntry ? drafts[selectedEntry.catalog.id] ?? createEntryDraft(selectedEntry) : null
  const selectedEntryDisplayProgress =
    selectedEntry && selectedDraft ? getDraftProgressState(selectedEntry, selectedDraft) : null
  const selectedEntryProgressControl =
    selectedEntryDisplayProgress ? getStructuredProgressControl(selectedEntryDisplayProgress) : null
  const selectedEntryProgressSelectValue =
    selectedEntryProgressControl && selectedDraft
      ? String(selectedDraft.listId === 'completed'
        ? selectedEntryProgressControl.total
        : selectedDraft.progressValue ?? selectedEntryProgressControl.current)
      : ''
  const selectedEntryProgressPercent =
    selectedEntry && selectedDraft && selectedEntryDisplayProgress
      ? getProgressPercentForState(selectedDraft.listId, selectedEntryDisplayProgress)
      : 0
  const selectedExplorerSavedListId = selectedExplorerMatch?.activity.status ?? null

  return {
    entries,
    explorerMatchedEntries,
    filteredEntries,
    pendingEntries: entries.filter((entry) => getCatalogSyncState(entry.catalog) === 'pending'),
    primaryViews,
    selectedDraft,
    selectedEntry,
    selectedEntryDisplayProgress,
    selectedEntryProgressControl,
    selectedEntryProgressPercent,
    selectedEntryProgressSelectValue,
    selectedExplorerIsSavedInSelectedList:
      selectedExplorerSavedListId !== null &&
      selectedExplorerSavedListId === selectedExplorerSaveListId,
    selectedExplorerItem,
    selectedExplorerMatch,
    sourceOptions: Array.from(new Set(entries.map((entry) => entry.activity.lastSource?.siteName ?? 'Unknown'))).sort(),
    typeOptions: Array.from(new Set(entries.map((entry) => entry.catalog.mediaType))).sort(),
    getDefaultExplorerSaveListId: () => getDefaultExplorerSaveListId(snapshot),
  }
}
