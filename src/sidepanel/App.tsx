import { startTransition, useEffect, useState, type FormEvent } from 'react'
import {
  addFromExplorer,
  addList,
  clearList,
  getExplorer,
  getLibrary,
  getMetadataForCatalogEntry,
  removeEntry,
  removeList,
  resolveDetectionMetadata,
  saveDetection,
  updateList,
  updateEntry,
} from '../shared/client'
import { EXPLORER_TAB_ID } from '../shared/constants'
import { parseLibraryNavigationTarget } from '../shared/navigation'
import {
  buildProgressStateFromControl,
  getProgressPercentForState,
  getResolvedProgressState,
  getStructuredProgressControl,
} from '../shared/progress'
import {
  getCardSeasonCountBadge,
  getLibraryEntrySeasonNumber,
  getMetadataSeasonNumber,
} from '../shared/season'
import { findMatchingLibraryEntryForMetadata, toLibraryEntries } from '../shared/selectors'
import { getTemporaryPoster } from '../shared/mock-posters'
import { areMediaTypesCompatible } from '../shared/metadata/matching'
import {
  isCatalogMetadataPending,
  isCatalogMetadataSynced,
} from '../shared/catalog-sync'
import type {
  DetectionResult,
  LibraryEntry,
  MetadataCard,
  WatchListDefinition,
  WatchLogSnapshot,
} from '../shared/types'
import {
  formatLocalizedDate,
  getLocalizedListDefinitionLabel,
  getLocalizedListLabel,
  getLocalizedMediaTypeLabel,
  getLocalizedProgressLabel,
} from '../shared/i18n/helpers'
import { useI18n } from '../shared/i18n/useI18n'
import { LanguageSelect } from '../shared/ui/LanguageSelect'
import { CustomSelect } from '../shared/ui/CustomSelect'
import { TranslatedDescription } from '../shared/ui/TranslatedDescription'
import { EntryDetailDrawer } from './EntryDetailDrawer'
import type { EntryDraft } from './types'
import './sidepanel.css'

const ALL_TITLES_VIEW_ID = 'all-titles'
const FAVORITES_VIEW_ID = 'favorites'

function getInitialSnapshot(): WatchLogSnapshot {
  return { catalog: [], activity: [], lists: [] }
}

function getInitialLibrarySelection(): {
  viewId: string
  catalogId: string | null
  query: string
} {
  if (typeof window === 'undefined') {
    return {
      viewId: ALL_TITLES_VIEW_ID,
      catalogId: null,
      query: '',
    }
  }

  const target = parseLibraryNavigationTarget(window.location.search)

  return {
    viewId: target.viewId ?? ALL_TITLES_VIEW_ID,
    catalogId: target.catalogId,
    query: target.query ?? '',
  }
}

function getViewCount(viewId: string, entries: LibraryEntry[], explorerItems: MetadataCard[]): number {
  if (viewId === ALL_TITLES_VIEW_ID) return entries.length
  if (viewId === FAVORITES_VIEW_ID) return entries.filter((entry) => entry.activity.favorite).length
  if (viewId === EXPLORER_TAB_ID) return explorerItems.length
  return entries.filter((entry) => entry.activity.status === viewId).length
}

function getViewTitle(
  viewId: string,
  snapshot: WatchLogSnapshot,
  t: ReturnType<typeof useI18n>['t'],
): string {
  if (viewId === ALL_TITLES_VIEW_ID) return t('views.allTitles')
  if (viewId === FAVORITES_VIEW_ID) return t('views.favorites')
  if (viewId === EXPLORER_TAB_ID) return t('views.explorer')
  return getLocalizedListLabel(snapshot.lists, viewId, t)
}

function getViewDescription(
  viewId: string,
  t: ReturnType<typeof useI18n>['t'],
): string {
  if (viewId === ALL_TITLES_VIEW_ID) {
    return t('library.viewDescription.allTitles')
  }
  if (viewId === 'watching') {
    return t('library.viewDescription.watching')
  }
  if (viewId === 'completed') {
    return t('library.viewDescription.completed')
  }
  if (viewId === FAVORITES_VIEW_ID) {
    return t('library.viewDescription.favorites')
  }
  if (viewId === EXPLORER_TAB_ID) {
    return t('library.viewDescription.explorer')
  }
  return t('library.viewDescription.custom')
}

function getProgressPercent(entry: LibraryEntry): number {
  return getProgressPercentForState(entry.activity.status, getEntryDisplayProgress(entry))
}

function getListEntryCount(listId: string, entries: LibraryEntry[]): number {
  return entries.filter((entry) => entry.activity.status === listId).length
}

function getEntryDisplayProgress(entry: LibraryEntry) {
  return getResolvedProgressState(entry.activity.currentProgress, entry.activity.status, {
    episodeCount: entry.catalog.episodeCount,
    chapterCount: entry.catalog.chapterCount,
  })
}

function getEntryDisplayProgressText(
  entry: LibraryEntry,
  t: ReturnType<typeof useI18n>['t'],
): string {
  return getLocalizedProgressLabel(getEntryDisplayProgress(entry), t)
}

function getDefaultExplorerSaveListId(snapshot: WatchLogSnapshot): string {
  return snapshot.lists.find((list) => list.id === 'library')?.id ?? snapshot.lists[0]?.id ?? 'library'
}

function createEntryDraft(entry: LibraryEntry): EntryDraft {
  const progress = getEntryDisplayProgress(entry)
  const control = getStructuredProgressControl(progress)

  return {
    title: entry.catalog.title,
    mediaType: entry.catalog.mediaType,
    notes: entry.activity.manualNotes,
    progressText: progress.progressText,
    progressValue: control?.current ?? null,
    listId: entry.activity.status,
    favorite: entry.activity.favorite,
  }
}

function getDraftProgressState(entry: LibraryEntry, draft: EntryDraft) {
  const baseProgress = getEntryDisplayProgress(entry)
  const control = getStructuredProgressControl(baseProgress)

  if (control) {
    const value = draft.listId === 'completed' ? control.total : draft.progressValue ?? control.current
    return buildProgressStateFromControl(baseProgress, draft.listId, control, value)
  }

  return getResolvedProgressState(
    {
      ...baseProgress,
      progressText: draft.progressText,
    },
    draft.listId,
    {
      episodeCount: entry.catalog.episodeCount,
      chapterCount: entry.catalog.chapterCount,
    },
  )
}

function getExplorerSourceLabel(item: MetadataCard, t: ReturnType<typeof useI18n>['t']): string {
  if (item.id.startsWith('anilist:')) {
    return 'AniList'
  }

  return t('library.mockCatalog')
}

function getMediaTypeBadgeClass(mediaType: LibraryEntry['catalog']['mediaType']): string {
  return `type-${mediaType}`
}

function formatCommunityScore(score?: number): string | null {
  if (score === undefined || Number.isNaN(score)) {
    return null
  }

  return score % 1 === 0 ? String(score) : score.toFixed(1)
}

function getCatalogSyncState(
  catalog: Pick<LibraryEntry['catalog'], 'metadataSyncStatus'>,
): 'synced' | 'pending' | null {
  if (isCatalogMetadataSynced(catalog)) {
    return 'synced'
  }

  if (isCatalogMetadataPending(catalog)) {
    return 'pending'
  }

  return null
}

type CatalogSyncVisualState = 'synced' | 'pending' | 'syncing'

function SyncStatusGlyph({
  state,
  className,
}: {
  state: CatalogSyncVisualState
  className?: string
}) {
  if (state === 'synced') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
        <path
          d="m6.5 12.5 3.3 3.3 7.7-8.1"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    )
  }

  if (state === 'syncing') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={`${className ?? ''} is-spinning`.trim()}
      >
        <path
          d="M20 12a8 8 0 1 1-2.34-5.66"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          d="M20 4v4h-4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
      <path
        d="M7 7 17 17M17 7 7 17"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function getExplorerCardSeasonBadge(item: MetadataCard): string | null {
  return getCardSeasonCountBadge(
    getMetadataSeasonNumber(item),
    item.episodeCount,
    item.chapterCount,
  )
}

function getLibraryCardSeasonBadge(entry: LibraryEntry): string | null {
  return getCardSeasonCountBadge(
    getLibraryEntrySeasonNumber(entry),
    entry.catalog.episodeCount ?? entry.activity.currentProgress.episodeTotal,
    entry.catalog.chapterCount ?? entry.activity.currentProgress.chapterTotal,
  )
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
      <path
        d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.63l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.28 7.28 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42H10.1a.5.5 0 0 0-.5.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.85a.5.5 0 0 0 .12.63l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.63l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.41 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .5.42h3.8a.5.5 0 0 0 .5-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.63l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
      <path
        d="M6 6 18 18M18 6 6 18"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

type NavGlyphKind = 'library' | 'watching' | 'completed' | 'favorites' | 'explorer'

function NavGlyph({ kind, className }: { kind: NavGlyphKind; className?: string }) {
  if (kind === 'library') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
        <path
          d="M5 6.5A2.5 2.5 0 0 1 7.5 4H19v14.5A1.5 1.5 0 0 0 17.5 17H7.5A2.5 2.5 0 0 0 5 19.5V6.5Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
        <path
          d="M7.5 4v13M9.5 8H16M9.5 11H16M9.5 14H13.5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </svg>
    )
  }

  if (kind === 'watching') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
        <circle
          cx="12"
          cy="12"
          r="8.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <path
          d="m10 8.8 5 3.2-5 3.2V8.8Z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </svg>
    )
  }

  if (kind === 'completed') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
        <circle
          cx="12"
          cy="12"
          r="8.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <path
          d="m8.5 12.3 2.4 2.4 4.8-5.2"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.9"
        />
      </svg>
    )
  }

  if (kind === 'favorites') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
        <path
          d="M12 19.2 5.9 13.5A4.1 4.1 0 0 1 11.7 7.8L12 8.1l.3-.3a4.1 4.1 0 0 1 5.8 5.7L12 19.2Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
      <circle
        cx="12"
        cy="12"
        r="8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M3.8 12h16.4M12 3.8c2.1 2.2 3.2 5 3.2 8.2S14.1 18 12 20.2C9.9 18 8.8 15.2 8.8 12S9.9 6 12 3.8Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  )
}

type ListModalState =
  | {
    mode: 'clear'
    listId: string
    label: string
    input: string
  }
  | {
    mode: 'delete'
    listId: string
    label: string
    input: string
  }

type EntryDeleteState = {
  catalogId: string
  title: string
}

type CatalogSyncFailure = {
  title: string
  reason: string
}

type CatalogSyncSummary = {
  total: number
  resolvedTitles: string[]
  failedItems: CatalogSyncFailure[]
}

function buildDetectionForCatalogSync(entry: LibraryEntry): DetectionResult {
  const progress = getResolvedProgressState(entry.activity.currentProgress, entry.activity.status, {
    episodeCount: entry.catalog.episodeCount,
    chapterCount: entry.catalog.chapterCount,
  })

  return {
    title: entry.catalog.title,
    normalizedTitle: entry.catalog.normalizedTitle,
    mediaType: entry.catalog.mediaType,
    sourceSite: entry.activity.lastSource?.siteName ?? 'Library',
    url: entry.activity.lastSource?.url ?? '',
    favicon: entry.activity.lastSource?.favicon ?? '',
    pageTitle: entry.activity.lastSource?.pageTitle ?? entry.catalog.title,
    season: progress.season,
    episode: progress.episode,
    episodeTotal: progress.episodeTotal,
    chapter: progress.chapter,
    chapterTotal: progress.chapterTotal,
    progressLabel: progress.progressText,
    confidence: 1,
  }
}

export function SidePanelApp() {
  const { locale, t } = useI18n()
  const [snapshot, setSnapshot] = useState<WatchLogSnapshot>(getInitialSnapshot)
  const [selectedViewId, setSelectedViewId] = useState(() => getInitialLibrarySelection().viewId)
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(
    () => getInitialLibrarySelection().catalogId,
  )
  const [selectedExplorerId, setSelectedExplorerId] = useState<string | null>(null)
  const [selectedExplorerSaveListId, setSelectedExplorerSaveListId] = useState('')
  const [libraryQuery, setLibraryQuery] = useState(() => getInitialLibrarySelection().query)
  const [typeFilter, setTypeFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [sortBy, setSortBy] = useState('recent')
  const [explorerQuery, setExplorerQuery] = useState('')
  const [explorerItems, setExplorerItems] = useState<MetadataCard[]>([])
  const [selectedEntryMetadata, setSelectedEntryMetadata] = useState<MetadataCard | null>(null)
  const [newListLabel, setNewListLabel] = useState('')
  const [activeListSettingsId, setActiveListSettingsId] = useState<string | null>(null)
  const [listNameDraft, setListNameDraft] = useState('')
  const [listModalState, setListModalState] = useState<ListModalState | null>(null)
  const [entryDeleteTarget, setEntryDeleteTarget] = useState<EntryDeleteState | null>(null)
  const [syncingCatalogIds, setSyncingCatalogIds] = useState<string[]>([])
  const [catalogSyncProgress, setCatalogSyncProgress] = useState<{
    processed: number
    total: number
  } | null>(null)
  const [catalogSyncSummary, setCatalogSyncSummary] = useState<CatalogSyncSummary | null>(null)
  const [isEntryAniListRefreshing, setIsEntryAniListRefreshing] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, EntryDraft>>({})
  const [statusMessageState, setStatusMessageState] = useState<{
    key:
    | 'library.loading'
    | 'library.ready'
    | 'library.listCreated'
    | 'library.listUpdated'
    | 'library.listDeleted'
    | 'library.listCleared'
    | 'library.listCreateFailed'
    | 'library.errorWithReason'
    | 'library.entryUpdated'
    | 'library.entryDeleted'
    | 'library.explorerRefreshed'
    | 'library.addedToList'
    | 'library.anilistRefreshRunning'
    | 'library.anilistRefreshDone'
    | 'library.anilistRefreshNoMatch'
    params?: Record<string, string>
  }>({ key: 'library.loading' })

  useEffect(() => {
    document.title = t('titles.library')
  }, [t])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.location.search) {
      return
    }

    const url = new URL(window.location.href)
    url.search = ''
    window.history.replaceState(null, '', url.toString())
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [libraryResponse, explorerResponse] = await Promise.all([getLibrary(), getExplorer()])
        if (cancelled) return
        startTransition(() => {
          setSnapshot(libraryResponse.snapshot)
          setExplorerItems(explorerResponse.items)
          setStatusMessageState({ key: 'library.ready' })
        })
      } catch (error) {
        console.error('[WatchLog] library:bootstrap:error', error)
        if (cancelled) return
        setStatusMessageState({
          key: 'library.errorWithReason',
          params: {
            reason: error instanceof Error ? error.message : 'bootstrap-failed',
          },
        })
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const handleStorageChange = async (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (
        areaName !== 'local' ||
        (!('watchlog.catalog' in changes) &&
          !('watchlog.activity' in changes) &&
          !('watchlog.lists' in changes))
      ) {
        return
      }

      try {
        const response = await getLibrary()
        startTransition(() => {
          setSnapshot(response.snapshot)
        })
      } catch (error) {
        console.error('[WatchLog] library:storage-refresh:error', error)
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange)

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [])

  const entries = toLibraryEntries(snapshot)
  const primaryViews = [
    { id: ALL_TITLES_VIEW_ID, label: t('views.allTitles'), icon: 'library' as const },
    { id: 'watching', label: t('lists.watching'), icon: 'watching' as const },
    { id: 'completed', label: t('lists.completed'), icon: 'completed' as const },
    { id: FAVORITES_VIEW_ID, label: t('views.favorites'), icon: 'favorites' as const },
    { id: EXPLORER_TAB_ID, label: t('views.explorer'), icon: 'explorer' as const },
  ]
  const queueLists = snapshot.lists.filter((list) => !['watching', 'completed'].includes(list.id))
  const activeListSettings =
    queueLists.find((list) => list.id === activeListSettingsId) ?? null
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
      const matchesSource =
        sourceFilter === 'all' || (entry.activity.lastSource?.siteName ?? 'Unknown') === sourceFilter
      return matchesQuery && matchesType && matchesSource
    })
    .sort((left, right) => {
      if (sortBy === 'title') return left.catalog.title.localeCompare(right.catalog.title)
      if (sortBy === 'progress') return getProgressPercent(right) - getProgressPercent(left)
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
    selectedExplorerId === null
      ? null
      : explorerItems.find((item) => item.id === selectedExplorerId) ?? null
  const explorerMatchedEntries = new Map(
    explorerItems.map((item) => [item.id, findMatchingLibraryEntryForMetadata(snapshot, item)]),
  )
  const selectedExplorerMatch =
    selectedExplorerItem === null ? null : explorerMatchedEntries.get(selectedExplorerItem.id) ?? null
  const selectedExplorerSavedListId = selectedExplorerMatch?.activity.status ?? null
  const selectedExplorerIsSavedInSelectedList =
    selectedExplorerSavedListId !== null &&
    selectedExplorerSavedListId === selectedExplorerSaveListId

  const selectedDraft = selectedEntry
    ? drafts[selectedEntry.catalog.id] ?? createEntryDraft(selectedEntry)
    : null
  const selectedEntryDetails = selectedEntryMetadata ?? selectedEntry?.catalog ?? null
  const selectedEntryDisplayProgress =
    selectedEntry && selectedDraft ? getDraftProgressState(selectedEntry, selectedDraft) : null
  const selectedEntryProgressControl = selectedEntryDisplayProgress
    ? getStructuredProgressControl(selectedEntryDisplayProgress)
    : null
  const selectedEntryProgressSelectValue =
    selectedEntryProgressControl && selectedDraft
      ? String(
        selectedDraft.listId === 'completed'
          ? selectedEntryProgressControl.total
          : selectedDraft.progressValue ?? selectedEntryProgressControl.current,
      )
      : ''
  const selectedEntryProgressPercent =
    selectedEntry && selectedDraft && selectedEntryDisplayProgress
      ? getProgressPercentForState(selectedDraft.listId, selectedEntryDisplayProgress)
      : 0
  const activeOverlay = activeListSettings ? 'list' : selectedEntry || selectedExplorerItem ? 'entry' : null

  const typeOptions = Array.from(new Set(entries.map((entry) => entry.catalog.mediaType))).sort()
  const sourceOptions = Array.from(
    new Set(entries.map((entry) => entry.activity.lastSource?.siteName ?? 'Unknown')),
  ).sort()
  const pendingEntries = entries.filter((entry) => getCatalogSyncState(entry.catalog) === 'pending')
  const syncingCatalogIdSet = new Set(syncingCatalogIds)
  const isCatalogSyncRunning = catalogSyncProgress !== null
  const catalogSyncButtonLabel = isCatalogSyncRunning
    ? t('library.syncPendingRunning', {
      current: catalogSyncProgress.processed,
      total: catalogSyncProgress.total,
    })
    : pendingEntries.length > 0
      ? t('library.syncPendingAction', { count: pendingEntries.length })
      : t('library.syncPendingNone')

  useEffect(() => {
    let cancelled = false

    if (!selectedEntry) {
      setSelectedEntryMetadata(null)
      return () => {
        cancelled = true
      }
    }

    setSelectedEntryMetadata(null)

    const loadMetadata = async () => {
      try {
        const metadata = await getMetadataForCatalogEntry(selectedEntry.catalog)
        if (!cancelled) {
          setSelectedEntryMetadata(metadata ?? null)
        }
      } catch (error) {
        console.warn('[WatchLog] library:selected-entry-metadata:error', error)
        if (!cancelled) {
          setSelectedEntryMetadata(null)
        }
      }
    }

    void loadMetadata()

    return () => {
      cancelled = true
    }
  }, [selectedEntry?.catalog.id])

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
      const response = await updateEntry({
        catalogId: selectedEntry.catalog.id,
        favorite: nextFavorite,
      })

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
        params: {
          reason: error instanceof Error ? error.message : 'favorite-toggle-failed',
        },
      })
    }
  }

  async function handleAddList(): Promise<void> {
    if (!newListLabel.trim()) return
    try {
      const response = await addList(newListLabel.trim())
      const libraryResponse = await getLibrary()
      setSnapshot(libraryResponse.snapshot)
      setSelectedViewId(response.list.id)
      setSelectedCatalogId(null)
      setNewListLabel('')
      setStatusMessageState({
        key: 'library.listCreated',
        params: { label: response.list.label },
      })
    } catch (error) {
      console.error('[WatchLog] handleAddList:error', error)
      setStatusMessageState({
        key: 'library.errorWithReason',
        params: {
          reason: error instanceof Error ? error.message : t('library.listCreateFailed'),
        },
      })
    }
  }

  function handleOpenListSettings(list: WatchListDefinition): void {
    setSelectedCatalogId(null)
    setActiveListSettingsId(list.id)
    setListNameDraft(list.label)
    setListModalState(null)
  }

  async function handleSaveListName(): Promise<void> {
    if (!activeListSettings || activeListSettings.kind !== 'custom') {
      return
    }

    try {
      const response = await updateList(activeListSettings.id, listNameDraft)
      setSnapshot(response.snapshot)
      setListNameDraft(response.list.label)
      setStatusMessageState({
        key: 'library.listUpdated',
        params: { label: response.list.label },
      })
    } catch (error) {
      setStatusMessageState({
        key: 'library.errorWithReason',
        params: {
          reason: error instanceof Error ? error.message : t('library.listCreateFailed'),
        },
      })
    }
  }

  function handleRequestClearList(): void {
    if (!activeListSettings) {
      return
    }

    setListModalState({
      mode: 'clear',
      listId: activeListSettings.id,
      label: activeListSettings.label,
      input: '',
    })
  }

  function handleRequestDeleteList(): void {
    if (!activeListSettings || activeListSettings.kind !== 'custom') {
      return
    }

    setListModalState({
      mode: 'delete',
      listId: activeListSettings.id,
      label: activeListSettings.label,
      input: '',
    })
  }

  async function handleConfirmListModal(): Promise<void> {
    if (!listModalState) {
      return
    }

    if (listModalState.mode === 'clear') {
      try {
        const response = await clearList(listModalState.listId)
        setSnapshot(response.snapshot)
        setSelectedCatalogId(null)
        setListModalState(null)
        setStatusMessageState({
          key: 'library.listCleared',
          params: { label: listModalState.label },
        })
      } catch (error) {
        setStatusMessageState({
          key: 'library.errorWithReason',
          params: {
            reason: error instanceof Error ? error.message : 'clear-list-failed',
          },
        })
      }
      return
    }

    if (listModalState.input.trim() !== listModalState.label) {
      setStatusMessageState({
        key: 'library.errorWithReason',
        params: {
          reason: t('library.deleteListTypeName'),
        },
      })
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
      setStatusMessageState({
        key: 'library.listDeleted',
        params: { label: listModalState.label },
      })
    } catch (error) {
      setStatusMessageState({
        key: 'library.errorWithReason',
        params: {
          reason: error instanceof Error ? error.message : t('library.listCreateFailed'),
        },
      })
    }
  }

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
      explorerMatchedEntries.get(itemId)?.activity.status ?? getDefaultExplorerSaveListId(snapshot),
    )
  }

  function handleSelectView(viewId: string): void {
    setActiveListSettingsId(null)
    setSelectedCatalogId(null)
    setSelectedExplorerId(null)
    setSelectedViewId(viewId)
  }

  function handleRequestDeleteEntry(): void {
    if (!selectedEntry) return

    setEntryDeleteTarget({
      catalogId: selectedEntry.catalog.id,
      title: selectedEntry.catalog.title,
    })
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
      setStatusMessageState({
        key: 'library.entryDeleted',
        params: { title: entryDeleteTarget.title },
      })
    } catch (error) {
      setStatusMessageState({
        key: 'library.errorWithReason',
        params: {
          reason: error instanceof Error ? error.message : 'remove-entry-failed',
        },
      })
    }
  }

  function buildSelectedDraftProgress(): ReturnType<typeof getResolvedProgressState> | null {
    if (!selectedEntry || !selectedDraft) {
      return null
    }

    const currentProgress = getEntryDisplayProgress(selectedEntry)
    const progressControl = getStructuredProgressControl(currentProgress)

    if (progressControl) {
      return buildProgressStateFromControl(
        currentProgress,
        selectedDraft.listId,
        progressControl,
        selectedDraft.listId === 'completed'
          ? progressControl.total
          : selectedDraft.progressValue ?? progressControl.current,
      )
    }

    return getResolvedProgressState(
      {
        ...currentProgress,
        progressText: selectedDraft.progressText,
      },
      selectedDraft.listId,
      {
        episodeCount: selectedEntry.catalog.episodeCount,
        chapterCount: selectedEntry.catalog.chapterCount,
      },
    )
  }

  async function handleRefreshEntryAniList(): Promise<void> {
    if (!selectedEntry || !selectedDraft || isEntryAniListRefreshing) {
      return
    }

    if (!['anime', 'manga', 'manhwa', 'manhua'].includes(selectedDraft.mediaType)) {
      setStatusMessageState({
        key: 'library.errorWithReason',
        params: {
          reason: t('library.syncReasonUnsupportedType', {
            type: getLocalizedMediaTypeLabel(selectedDraft.mediaType, t),
          }),
        },
      })
      return
    }

    setIsEntryAniListRefreshing(true)
    setStatusMessageState({ key: 'library.anilistRefreshRunning' })

    try {
      const detection = {
        ...buildDetectionForCatalogSync(selectedEntry),
        mediaType: selectedDraft.mediaType,
      }
      const metadata = await resolveDetectionMetadata(detection)

      if (!metadata) {
        setStatusMessageState({ key: 'library.anilistRefreshNoMatch' })
        return
      }

      const nextProgress = buildSelectedDraftProgress()
      const response = await updateEntry({
        catalogId: selectedEntry.catalog.id,
        title: selectedDraft.title,
        mediaType: selectedDraft.mediaType,
        listId: selectedDraft.listId,
        favorite: selectedDraft.favorite,
        manualNotes: selectedDraft.notes,
        progress: nextProgress ?? undefined,
        metadataRefresh: metadata,
      })

      setSnapshot(response.snapshot)
      const persistedEntry = response.entry
      if (persistedEntry) {
        setDrafts((current) => ({
          ...current,
          [persistedEntry.catalog.id]: createEntryDraft(persistedEntry),
        }))
      }
      setSelectedEntryMetadata(metadata)
      setStatusMessageState({ key: 'library.anilistRefreshDone' })
    } catch (error) {
      setStatusMessageState({
        key: 'library.errorWithReason',
        params: {
          reason: t('library.syncReasonRequestFailed', {
            reason: error instanceof Error ? error.message : 'anilist-refresh-failed',
          }),
        },
      })
    } finally {
      setIsEntryAniListRefreshing(false)
    }
  }

  async function handleSaveEntry(): Promise<void> {
    if (!selectedEntry || !selectedDraft) return
    const nextProgress = buildSelectedDraftProgress()
    const response = await updateEntry({
      catalogId: selectedEntry.catalog.id,
      title: selectedDraft.title,
      mediaType: selectedDraft.mediaType,
      listId: selectedDraft.listId,
      favorite: selectedDraft.favorite,
      manualNotes: selectedDraft.notes,
      progress: nextProgress ?? undefined,
    })
    setSnapshot(response.snapshot)
    const persistedEntry = response.entry
    if (persistedEntry) {
      setDrafts((current) => ({
        ...current,
        [persistedEntry.catalog.id]: createEntryDraft(persistedEntry),
      }))
    }
    setStatusMessageState({ key: 'library.entryUpdated' })
  }

  async function handleExplorerSearch(): Promise<void> {
    const response = await getExplorer(explorerQuery)
    setExplorerItems(response.items)
    setStatusMessageState({ key: 'library.explorerRefreshed' })
  }

  async function handleTopbarSearchSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    if (selectedViewId === EXPLORER_TAB_ID) {
      await handleExplorerSearch()
    }
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

  async function handleSyncPendingCatalog(): Promise<void> {
    if (isCatalogSyncRunning || pendingEntries.length === 0) {
      return
    }

    const queue = pendingEntries
    const queueIds = queue.map((entry) => entry.catalog.id)
    const resolvedTitles: string[] = []
    const failedItems: CatalogSyncFailure[] = []

    setCatalogSyncSummary(null)
    setSyncingCatalogIds(queueIds)
    setCatalogSyncProgress({
      processed: 0,
      total: queue.length,
    })

    try {
      for (let index = 0; index < queue.length; index += 1) {
        const entry = queue[index]
        let failureReason: string | null = null

        try {
          if (!['anime', 'manga', 'manhwa', 'manhua'].includes(entry.catalog.mediaType)) {
            failureReason = t('library.syncReasonUnsupportedType', {
              type: getLocalizedMediaTypeLabel(entry.catalog.mediaType, t),
            })
          } else {
            const detection = buildDetectionForCatalogSync(entry)
            const metadata = await resolveDetectionMetadata(detection)
            if (!metadata) {
              failureReason = t('library.syncReasonNoMatch')
            } else if (!areMediaTypesCompatible(metadata.mediaType, entry.catalog.mediaType)) {
              failureReason = t('library.syncReasonTypeMismatch', {
                expected: getLocalizedMediaTypeLabel(entry.catalog.mediaType, t),
                received: getLocalizedMediaTypeLabel(metadata.mediaType, t),
              })
            } else {
              const response = await saveDetection({
                detection,
                listId: entry.activity.status,
                favorite: entry.activity.favorite,
                metadata,
                metadataSyncStatus: 'synced',
                skipMetadataLookup: true,
                disableTemporaryPoster: true,
              })

              setSnapshot(response.snapshot)
              resolvedTitles.push(entry.catalog.title)
            }
          }
        } catch (error) {
          failureReason = t('library.syncReasonRequestFailed', {
            reason: error instanceof Error ? error.message : 'sync-failed',
          })
        }

        if (failureReason) {
          failedItems.push({
            title: entry.catalog.title,
            reason: failureReason,
          })
        }

        setSyncingCatalogIds((current) => current.filter((catalogId) => catalogId !== entry.catalog.id))
        setCatalogSyncProgress({
          processed: index + 1,
          total: queue.length,
        })

        if (index < queue.length - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 3000))
        }
      }
    } finally {
      setSyncingCatalogIds([])
      setCatalogSyncProgress(null)
      setCatalogSyncSummary({
        total: queue.length,
        resolvedTitles,
        failedItems,
      })
    }
  }

  const statusMessage = t(statusMessageState.key, statusMessageState.params)
  const showTopbarError = statusMessageState.key === 'library.errorWithReason'

  return (
    <div className="sidepanel-shell library-shell">
      <aside className="library-sidebar">
        <div className="library-sidebar-inner">
          <div className="library-brand">
            <div className="library-brand-mark">
              <img className="brand-icon" src="/icons/favicon-32x32.png" alt="WatchLog logo" />
            </div>
            <div>
              <h1 className="library-brand-title">{t('common.appName')}</h1>
              <p className="library-brand-status">{t('library.statusLocalFirst')}</p>
            </div>
          </div>

          <nav className="library-nav">
            {primaryViews.map((view) => (
              <button
                key={view.id}
                className={`library-nav-button ${selectedViewId === view.id ? 'is-active' : ''}`}
                type="button"
                onClick={() => handleSelectView(view.id)}
              >
                <div className={`content-elements ${selectedViewId === view.id ? 'is-active' : ''}`}>
                  <span className="library-nav-icon">
                    <NavGlyph kind={view.icon} className="library-nav-icon-symbol" />
                  </span>
                  <span className="library-nav-copy">
                    <strong>{view.label}</strong>
                    <span>
                      {t(
                        getViewCount(view.id, entries, explorerItems) === 1
                          ? 'library.items.one'
                          : 'library.items.other',
                        { count: getViewCount(view.id, entries, explorerItems) },
                      )}
                    </span>
                  </span>
                </div>
              </button>
            ))}
          </nav>

          <div className="library-sidebar-section">
            <p className="library-sidebar-label">{t('library.queues')}</p>
            <div className="library-queue-list">
              {queueLists.map((list) => (
                <div
                  key={list.id}
                  className={`queue-list-item is-removable ${selectedViewId === list.id ? 'is-active' : ''}`}
                >
                  <button
                    className="queue-list-main"
                    type="button"
                    onClick={() => handleSelectView(list.id)}
                  >
                    <strong>{getLocalizedListDefinitionLabel(list, t)}</strong>
                    <span>
                      {t(
                        getListEntryCount(list.id, entries) === 1
                          ? 'library.items.one'
                          : 'library.items.other',
                        { count: getListEntryCount(list.id, entries) },
                      )}
                    </span>
                  </button>
                  <button
                    className="queue-list-settings"
                    type="button"
                    title={t('library.listSettings')}
                    aria-label={t('library.listSettings')}
                    onClick={() => handleOpenListSettings(list)}
                  >
                    <SettingsIcon className="queue-settings-icon" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="library-sidebar-section">
            <p className="library-sidebar-label">{t('library.createList')}</p>
            <input
              className="field"
              value={newListLabel}
              placeholder={t('library.createListPlaceholder')}
              onChange={(event) => setNewListLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void handleAddList()
                }
              }}
            />
            <button className="button secondary" type="button" onClick={handleAddList}>
              {t('library.addList')}
            </button>
          </div>

          <button className="library-settings-button" type="button" onClick={() => void chrome.runtime.openOptionsPage()}>
            <SettingsIcon className="library-settings-icon" />
            <span>{t('common.settings')}</span>
          </button>
          <p className="library-settings-attribution tiny">{t('library.sidebarAttribution')}</p>
        </div>
      </aside>

      <div className="library-main">
        <header className="library-topbar">
          <div>
            <h2 className="library-topbar-title">{t('library.topbarTitle')}</h2>
            <p className="library-topbar-subtitle">{getViewDescription(selectedViewId, t)}</p>
          </div>
          <div className="library-topbar-actions">
            <form className="library-search-group" onSubmit={(event) => void handleTopbarSearchSubmit(event)}>
              <label className="library-search">
                <span>{t('common.search')}</span>
                <input
                  value={selectedViewId === EXPLORER_TAB_ID ? explorerQuery : libraryQuery}
                  placeholder={
                    selectedViewId === EXPLORER_TAB_ID
                      ? t('library.searchExplorerPlaceholder')
                      : t('library.searchLibraryPlaceholder')
                  }
                  onChange={(event) =>
                    selectedViewId === EXPLORER_TAB_ID
                      ? setExplorerQuery(event.target.value)
                      : setLibraryQuery(event.target.value)
                  }
                />
              </label>
              {selectedViewId === EXPLORER_TAB_ID ? (
                <button className="library-chip-button" type="submit">
                  {t('library.searchAction')}
                </button>
              ) : null}
            </form>
            <LanguageSelect className="library-language-select" compact />
            {selectedViewId !== EXPLORER_TAB_ID ? (
              showTopbarError ? (
                <span className="library-status-chip">{statusMessage}</span>
              ) : (
                <span className="library-storage-badge" title={statusMessage}>
                  {t('library.localStoredBadge')}
                </span>
              )
            ) : null}
          </div>
        </header>

        <main className="library-content">
          <section className="library-filter-bar">
            <div className="library-filter-group">
              <span className="library-filter-chip is-static">
                {getViewTitle(selectedViewId, snapshot, t)}
              </span>
              {selectedViewId !== EXPLORER_TAB_ID ? (
                <>
                  <label className="library-filter-chip">
                    <CustomSelect
                      value={typeFilter}
                      onChange={setTypeFilter}
                      options={[
                        { value: 'all', label: t('library.typeAll') },
                        ...typeOptions.map((mediaType) => ({
                          value: mediaType,
                          label: `${t('library.typePrefix')}: ${getLocalizedMediaTypeLabel(
                            mediaType as LibraryEntry['catalog']['mediaType'],
                            t,
                          )}`,
                        })),
                      ]}
                    />
                  </label>
                  <label className="library-filter-chip">
                    <CustomSelect
                      value={sourceFilter}
                      onChange={setSourceFilter}
                      options={[
                        { value: 'all', label: t('library.platformAny') },
                        ...sourceOptions.map((source) => ({
                          value: source,
                          label: `${t('library.platformPrefix')}: ${
                            source === 'Unknown' ? t('common.unknown') : source
                          }`,
                        })),
                      ]}
                    />
                  </label>
                </>
              ) : null}
            </div>

            <div className="library-filter-group">
              {selectedViewId !== EXPLORER_TAB_ID ? (
                <label className="library-filter-chip">
                  <CustomSelect
                    value={sortBy}
                    onChange={setSortBy}
                    options={[
                      { value: 'recent', label: t('library.sortRecents') },
                      { value: 'title', label: t('library.sortTitle') },
                      { value: 'progress', label: t('library.sortProgress') },
                    ]}
                  />
                </label>
              ) : null}
              {selectedViewId !== EXPLORER_TAB_ID ? (
                <button
                  className="button secondary library-sync-button"
                  type="button"
                  disabled={isCatalogSyncRunning || pendingEntries.length === 0}
                  onClick={() => void handleSyncPendingCatalog()}
                >
                  {catalogSyncButtonLabel}
                </button>
              ) : null}
              <span className="library-status-chip">
                {selectedViewId === EXPLORER_TAB_ID
                  ? t(
                    explorerItems.length === 1
                      ? 'library.explorerCards.one'
                      : 'library.explorerCards.other',
                    { count: explorerItems.length },
                  )
                  : t(
                    filteredEntries.length === 1
                      ? 'library.visibleItems.one'
                      : 'library.visibleItems.other',
                    { count: filteredEntries.length },
                  )}
              </span>
            </div>
          </section>

          {selectedViewId === EXPLORER_TAB_ID ? (
            <section className="library-grid explorer-grid">
              {explorerItems.map((item) => {
                const existingEntry = explorerMatchedEntries.get(item.id) ?? null
                const seasonBadge = getExplorerCardSeasonBadge(item)

                return (
                  <article
                    className={`library-card explorer-card ${selectedExplorerItem?.id === item.id ? 'is-selected' : ''}`}
                    key={item.id}
                    onClick={() => handleSelectExplorerItem(item.id)}
                  >
                    <div className="library-card-poster-wrap">
                      <img className="library-card-poster" src={item.poster ?? getTemporaryPoster(item.normalizedTitle)} alt={item.title} />
                      <span className="library-card-overlay" />
                      {seasonBadge ? (
                        <span className="library-card-season-badge">{seasonBadge}</span>
                      ) : null}
                      <div className="library-card-badges">
                        <div className="library-card-badge-group">
                          <span className={`media-badge ${getMediaTypeBadgeClass(item.mediaType)}`}>
                            {getLocalizedMediaTypeLabel(item.mediaType, t)}
                          </span>
                        </div>
                        {formatCommunityScore(item.score) ? (
                          <span className="score-badge">{formatCommunityScore(item.score)}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="library-card-body">
                      <div>
                        <h3 className="library-card-title">{item.title}</h3>
                        <p className="library-card-source">{getExplorerSourceLabel(item, t)}</p>
                      </div>
                      <div className="genre-row">
                        {item.genres.slice(0, 3).map((genre) => (
                          <span className="genre-chip" key={genre}>{genre}</span>
                        ))}
                      </div>
                      <TranslatedDescription
                        className="library-card-description"
                        emptyFallback={t('library.noMetadataYet')}
                        locale={locale}
                        t={t}
                        text={item.description}
                      />
                      {existingEntry ? (
                        <p
                          className="explorer-existing-link"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleOpenExistingExplorerEntry(existingEntry)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              event.stopPropagation()
                              handleOpenExistingExplorerEntry(existingEntry)
                            }
                          }}
                          role="link"
                          tabIndex={0}
                          >
                          {t('library.addedInList', {
                            label: getLocalizedListLabel(snapshot.lists, existingEntry.activity.status, t),
                          })}
                        </p>
                      ) : selectedExplorerItem?.id === item.id &&
                        selectedExplorerIsSavedInSelectedList &&
                        selectedExplorerMatch ? (
                        <button
                          className="button secondary"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleOpenExistingExplorerEntry(selectedExplorerMatch)
                          }}
                        >
                          {t('library.savedInList', {
                            label: getLocalizedListLabel(
                              snapshot.lists,
                              selectedExplorerMatch.activity.status,
                              t,
                            ),
                          })}
                        </button>
                      ) : selectedExplorerItem?.id === item.id ? (
                        <button
                          className="button"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            void handleExplorerAdd(item, selectedExplorerSaveListId)
                          }}
                        >
                          {t('common.save')}
                        </button>
                      ) : (
                        <button
                          className="button"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            void handleExplorerAdd(item, getDefaultExplorerSaveListId(snapshot))
                          }}
                        >
                          {t('library.addToLibrary')}
                        </button>
                      )}
                    </div>
                  </article>
                )
              })}
            </section>
          ) : filteredEntries.length === 0 ? (
            <section className="library-empty-state panel">
              <h3>{t('library.noTitlesMatched')}</h3>
              <p>{t('library.noTitlesHint')}</p>
            </section>
          ) : (
            <>
              <section className="library-grid">
                {filteredEntries.map((entry) => {
                  const progress = getProgressPercent(entry)
                  const platform = entry.activity.lastSource?.siteName ?? t('library.manualEntry')
                  const seasonBadge = getLibraryCardSeasonBadge(entry)
                  const baseSyncState = getCatalogSyncState(entry.catalog)
                  const syncState: CatalogSyncVisualState | null = syncingCatalogIdSet.has(entry.catalog.id)
                    ? 'syncing'
                    : baseSyncState
                  const showPendingPlaceholder =
                    (baseSyncState === 'pending' || syncState === 'syncing') && !entry.catalog.poster

                  return (
                    <article
                      key={entry.catalog.id}
                      className={`library-card ${selectedEntry?.catalog.id === entry.catalog.id ? 'is-selected' : ''}`}
                      onClick={() => handleSelectEntry(entry.catalog.id)}
                    >
                      <div className="library-card-poster-wrap">
                        {showPendingPlaceholder ? (
                          <div className="library-card-poster library-card-poster-placeholder" aria-hidden="true" />
                        ) : (
                          <img
                            className="library-card-poster"
                            src={entry.catalog.poster ?? getTemporaryPoster(entry.catalog.normalizedTitle)}
                            alt={entry.catalog.title}
                          />
                        )}
                        <span className="library-card-overlay" />
                        {seasonBadge ? (
                          <span className="library-card-season-badge">{seasonBadge}</span>
                        ) : null}
                        <div className="library-card-badges">
                          <div className="library-card-badge-group">
                            <span className={`media-badge ${getMediaTypeBadgeClass(entry.catalog.mediaType)}`}>
                              {getLocalizedMediaTypeLabel(entry.catalog.mediaType, t)}
                            </span>
                            {entry.activity.favorite ? <span className="favorite-badge">{t('common.favorite')}</span> : null}
                          </div>
                          <div className="library-card-status-group">
                            {syncState ? (
                              <span className={`catalog-sync-badge is-${syncState}`}>
                                <SyncStatusGlyph
                                  className="catalog-sync-icon"
                                  state={syncState}
                                />
                              </span>
                            ) : null}
                            {formatCommunityScore(entry.catalog.score) ? (
                              <span className="score-badge">{formatCommunityScore(entry.catalog.score)}</span>
                            ) : null}
                          </div>
                        </div>
                        <div className="library-card-progress">
                          <div className="library-card-progress-copy">
                            <span>
                              {entry.activity.status === 'completed'
                                ? t('library.completedTrack')
                                : t('library.activeTrack')}
                            </span>
                            <span>{progress > 0 ? `${progress}%` : getEntryDisplayProgressText(entry, t)}</span>
                          </div>
                          <div className="library-card-progress-track">
                            <div className="library-card-progress-value" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                      </div>
                      <div className="library-card-body">
                        <div>
                          <h3 className="library-card-title">{entry.catalog.title}</h3>
                          <p className="library-card-source">{platform}</p>
                        </div>
                        <div className="genre-row">
                          {(entry.catalog.genres.length > 0
                            ? entry.catalog.genres
                            : [getLocalizedListLabel(snapshot.lists, entry.activity.status, t)])
                            .slice(0, 3)
                            .map((token) => (
                              <span className="genre-chip" key={token}>{token}</span>
                            ))}
                        </div>
                        <p className="library-card-description">{getEntryDisplayProgressText(entry, t)}</p>
                      </div>
                    </article>
                  )
                })}
              </section>

              {selectedEntry && selectedDraft ? null : null}
            </>
          )}
        </main>
      </div>

      <EntryDetailDrawer
        locale={locale}
        snapshot={snapshot}
        t={t}
        selectedEntry={selectedEntry}
        selectedDraft={selectedDraft}
        selectedExplorerItem={selectedExplorerItem}
        selectedExplorerMatch={selectedExplorerMatch}
        selectedEntryDisplayProgress={selectedEntryDisplayProgress}
        selectedEntryProgressControl={selectedEntryProgressControl}
        selectedEntryProgressPercent={selectedEntryProgressPercent}
        selectedEntryProgressSelectValue={selectedEntryProgressSelectValue}
        selectedEntryDetails={selectedEntryDetails}
        isEntryAniListRefreshing={isEntryAniListRefreshing}
        selectedExplorerSaveListId={selectedExplorerSaveListId}
        onUpdateDraft={updateDraft}
        onToggleFavorite={handleToggleFavorite}
        onSaveEntry={handleSaveEntry}
        onRefreshEntryAniList={handleRefreshEntryAniList}
        onCloseSelectedEntry={() => setSelectedCatalogId(null)}
        onCloseSelectedExplorer={() => setSelectedExplorerId(null)}
        onDeleteEntry={handleRequestDeleteEntry}
        onOpenExistingExplorerEntry={handleOpenExistingExplorerEntry}
        onExplorerSaveListChange={setSelectedExplorerSaveListId}
        onExplorerSave={(item, listId) => void handleExplorerAdd(item, listId)}
      />

      <div
        className={`list-settings-scrim ${activeOverlay ? 'is-visible' : ''}`}
        aria-hidden="true"
        onClick={() => {
          setActiveListSettingsId(null)
          setSelectedCatalogId(null)
          setSelectedExplorerId(null)
        }}
      />

      <aside className={`list-settings-drawer ${activeListSettings ? 'is-open' : ''}`}>
        {activeListSettings ? (
          <>
            <div className="list-settings-header">
              <div>
                <p className="library-detail-kicker">{t('library.listSettings')}</p>
                <h3 className="list-settings-title">{activeListSettings.label}</h3>
              </div>
              <button
                className="list-settings-close"
                type="button"
                aria-label={t('common.close')}
                onClick={() => setActiveListSettingsId(null)}
              >
                <CloseIcon className="list-settings-close-icon" />
              </button>
            </div>

            <div className="list-settings-metrics">
              <div className="field-card">
                <span className="list-settings-metric-label">{t('library.listCreatedAt')}</span>
                <strong>
                  {activeListSettings.createdAt
                    ? formatLocalizedDate(activeListSettings.createdAt, locale)
                    : t('common.unknown')}
                </strong>
              </div>
              <div className="field-card">
                <span className="list-settings-metric-label">{t('library.listItemCount')}</span>
                <strong>
                  {t(
                    getListEntryCount(activeListSettings.id, entries) === 1
                      ? 'library.items.one'
                      : 'library.items.other',
                    { count: getListEntryCount(activeListSettings.id, entries) },
                  )}
                </strong>
              </div>
            </div>

            <div className="field-card list-settings-section">
              <label className="label" htmlFor="list-name-draft">
                {t('library.listName')}
              </label>
              <input
                id="list-name-draft"
                className="field"
                value={listNameDraft}
                disabled={activeListSettings.kind !== 'custom'}
                onChange={(event) => setListNameDraft(event.target.value)}
              />
              <button
                className="button secondary"
                type="button"
                disabled={
                  activeListSettings.kind !== 'custom' ||
                  listNameDraft.trim() === activeListSettings.label
                }
                onClick={() => void handleSaveListName()}
              >
                {t('library.saveListName')}
              </button>
            </div>

            <div className="field-card list-settings-section">
              <p className="list-settings-action-copy">
                {t('library.clearListConfirmBody', { label: activeListSettings.label })}
              </p>
              <button className="button secondary" type="button" onClick={handleRequestClearList}>
                {t('library.clearList')}
              </button>
            </div>

            {activeListSettings.kind === 'custom' ? (
              <div className="field-card list-settings-section list-settings-danger">
                <p className="list-settings-action-copy">
                  {t('library.deleteListConfirmBody', { label: activeListSettings.label })}
                </p>
                <button className="button danger" type="button" onClick={handleRequestDeleteList}>
                  {t('library.deleteList')}
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </aside>

      {listModalState ? (
        <div className="library-modal-backdrop" role="presentation">
          <div className="library-modal panel" role="dialog" aria-modal="true">
            <div className="list-settings-header">
              <div>
                <p className="library-detail-kicker">
                  {listModalState.mode === 'delete'
                    ? t('library.deleteList')
                    : t('library.clearList')}
                </p>
                <h3 className="list-settings-title">
                  {listModalState.mode === 'delete'
                    ? t('library.deleteListConfirmTitle')
                    : t('library.clearListConfirmTitle')}
                </h3>
              </div>
              <button
                className="list-settings-close"
                type="button"
                aria-label={t('common.close')}
                onClick={() => setListModalState(null)}
              >
                <CloseIcon className="list-settings-close-icon" />
              </button>
            </div>

            <p className="library-detail-copy">
              {listModalState.mode === 'delete'
                ? t('library.deleteListConfirmBody', { label: listModalState.label })
                : t('library.clearListConfirmBody', { label: listModalState.label })}
            </p>

            {listModalState.mode === 'delete' ? (
              <div className="field-card list-settings-section">
                <label className="label" htmlFor="delete-list-confirm">
                  {t('library.deleteListTypeName')}
                </label>
                <input
                  id="delete-list-confirm"
                  className="field"
                  value={listModalState.input}
                  onChange={(event) =>
                    setListModalState({
                      ...listModalState,
                      input: event.target.value,
                    })
                  }
                />
              </div>
            ) : null}

            <div className="library-modal-actions">
              <button
                className="button secondary"
                type="button"
                onClick={() => setListModalState(null)}
              >
                {t('common.cancel')}
              </button>
              <button
                className={`button ${listModalState.mode === 'delete' ? 'danger' : ''}`}
                type="button"
                onClick={() => void handleConfirmListModal()}
              >
                {listModalState.mode === 'delete'
                  ? t('library.confirmDeleteList')
                  : t('library.confirmClearList')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {entryDeleteTarget ? (
        <div className="library-modal-backdrop" role="presentation">
          <div className="library-modal panel" role="dialog" aria-modal="true">
            <div className="list-settings-header">
              <div>
                <p className="library-detail-kicker">{t('library.deleteItem')}</p>
                <h3 className="list-settings-title">{t('library.deleteItemConfirmTitle')}</h3>
              </div>
              <button
                className="list-settings-close"
                type="button"
                aria-label={t('common.close')}
                onClick={() => setEntryDeleteTarget(null)}
              >
                <CloseIcon className="list-settings-close-icon" />
              </button>
            </div>

            <p className="library-detail-copy">
              {t('library.deleteItemConfirmBody', { title: entryDeleteTarget.title })}
            </p>

            <div className="library-modal-actions">
              <button
                className="button secondary"
                type="button"
                onClick={() => setEntryDeleteTarget(null)}
              >
                {t('common.cancel')}
              </button>
              <button className="button danger" type="button" onClick={() => void handleConfirmDeleteEntry()}>
                {t('library.confirmDeleteItem')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {catalogSyncSummary ? (
        <div className="library-modal-backdrop" role="presentation">
          <div className="library-modal panel library-sync-summary-modal" role="dialog" aria-modal="true">
            <div className="list-settings-header">
              <div>
                <p className="library-detail-kicker">{t('library.syncSummaryKicker')}</p>
                <h3 className="list-settings-title">{t('library.syncSummaryTitle')}</h3>
              </div>
              <button
                className="list-settings-close"
                type="button"
                aria-label={t('common.close')}
                onClick={() => setCatalogSyncSummary(null)}
              >
                <CloseIcon className="list-settings-close-icon" />
              </button>
            </div>

            <p className="library-detail-copy">
              {t('library.syncSummaryBody', {
                total: catalogSyncSummary.total,
                resolved: catalogSyncSummary.resolvedTitles.length,
                failed: catalogSyncSummary.failedItems.length,
              })}
            </p>

            {catalogSyncSummary.resolvedTitles.length > 0 ? (
              <div className="library-sync-summary-section">
                <p className="library-sync-summary-heading">
                  {t('library.syncSummaryResolved', {
                    count: catalogSyncSummary.resolvedTitles.length,
                  })}
                </p>
                <div className="library-sync-summary-list">
                  {catalogSyncSummary.resolvedTitles.map((title) => (
                    <div key={title} className="library-sync-summary-item">
                      <strong>{title}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {catalogSyncSummary.failedItems.length > 0 ? (
              <div className="library-sync-summary-section">
                <p className="library-sync-summary-heading">
                  {t('library.syncSummaryFailed', {
                    count: catalogSyncSummary.failedItems.length,
                  })}
                </p>
                <div className="library-sync-summary-list">
                  {catalogSyncSummary.failedItems.map((item) => (
                    <div key={`${item.title}:${item.reason}`} className="library-sync-summary-item">
                      <strong>{item.title}</strong>
                      <span>{item.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="library-modal-actions">
              <button
                className="button"
                type="button"
                onClick={() => setCatalogSyncSummary(null)}
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
