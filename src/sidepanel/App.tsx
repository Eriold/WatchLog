import { startTransition, useEffect, useState, type FormEvent } from 'react'
import {
  addFromExplorer,
  addList,
  clearList,
  getExplorer,
  getLibrary,
  removeEntry,
  removeList,
  updateList,
  updateEntry,
} from '../shared/client'
import { EXPLORER_TAB_ID } from '../shared/constants'
import { toLibraryEntries } from '../shared/selectors'
import { getTemporaryPoster } from '../shared/mock-posters'
import type {
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
} from '../shared/i18n/helpers'
import { useI18n } from '../shared/i18n/useI18n'
import { LanguageSelect } from '../shared/ui/LanguageSelect'
import './sidepanel.css'

const ALL_TITLES_VIEW_ID = 'all-titles'
const FAVORITES_VIEW_ID = 'favorites'

function getInitialSnapshot(): WatchLogSnapshot {
  return { catalog: [], activity: [], lists: [] }
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
  const progress = entry.activity.currentProgress
  if (progress.episode !== undefined && progress.episodeTotal && progress.episodeTotal > 0) {
    return Math.min(100, Math.max(0, Math.round((progress.episode / progress.episodeTotal) * 100)))
  }
  if (progress.chapter !== undefined && progress.chapterTotal && progress.chapterTotal > 0) {
    return Math.min(100, Math.max(0, Math.round((progress.chapter / progress.chapterTotal) * 100)))
  }
  const percentMatch = progress.progressText.match(/(\d{1,3})\s*%/)
  if (percentMatch) {
    return Math.min(100, Math.max(0, Number.parseInt(percentMatch[1], 10)))
  }
  return entry.activity.status === 'completed' ? 100 : 0
}

function getListEntryCount(listId: string, entries: LibraryEntry[]): number {
  return entries.filter((entry) => entry.activity.status === listId).length
}

function getStatusTone(status: string, favorite: boolean): string {
  if (favorite) return 'favorite'
  if (status === 'watching') return 'watching'
  if (status === 'completed') return 'completed'
  if (status === 'paused') return 'paused'
  if (status === 'library') return 'planned'
  if (status === 'planned') return 'planned'
  return 'default'
}

function getRemainingUnits(entry: LibraryEntry): number | null {
  const progress = entry.activity.currentProgress

  if (progress.episode !== undefined && progress.episodeTotal) {
    return Math.max(0, progress.episodeTotal - progress.episode)
  }

  if (progress.chapter !== undefined && progress.chapterTotal) {
    return Math.max(0, progress.chapterTotal - progress.chapter)
  }

  return null
}

function getProgressCurrentValue(entry: LibraryEntry): string {
  const progress = entry.activity.currentProgress

  if (progress.episode !== undefined) {
    return String(progress.episode).padStart(2, '0')
  }

  if (progress.chapter !== undefined) {
    return String(progress.chapter).padStart(2, '0')
  }

  return '--'
}

function getProgressTotalValue(entry: LibraryEntry): string {
  const progress = entry.activity.currentProgress

  if (progress.episodeTotal !== undefined) {
    return String(progress.episodeTotal).padStart(2, '0')
  }

  if (progress.chapterTotal !== undefined) {
    return String(progress.chapterTotal).padStart(2, '0')
  }

  return '--'
}

function getExplorerSourceLabel(item: MetadataCard, t: ReturnType<typeof useI18n>['t']): string {
  if (item.id.startsWith('anilist:')) {
    return 'AniList'
  }

  return t('library.mockCatalog')
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

export function SidePanelApp() {
  const { locale, t } = useI18n()
  const [snapshot, setSnapshot] = useState<WatchLogSnapshot>(getInitialSnapshot)
  const [selectedViewId, setSelectedViewId] = useState(ALL_TITLES_VIEW_ID)
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null)
  const [libraryQuery, setLibraryQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [sortBy, setSortBy] = useState('recent')
  const [explorerQuery, setExplorerQuery] = useState('')
  const [explorerItems, setExplorerItems] = useState<MetadataCard[]>([])
  const [newListLabel, setNewListLabel] = useState('')
  const [activeListSettingsId, setActiveListSettingsId] = useState<string | null>(null)
  const [listNameDraft, setListNameDraft] = useState('')
  const [listModalState, setListModalState] = useState<ListModalState | null>(null)
  const [entryDeleteTarget, setEntryDeleteTarget] = useState<EntryDeleteState | null>(null)
  const [drafts, setDrafts] = useState<Record<string, { notes: string; progressText: string; listId: string; favorite: boolean }>>({})
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
      | 'library.addedToLibrary'
    params?: Record<string, string>
  }>({ key: 'library.loading' })

  useEffect(() => {
    document.title = t('titles.library')
  }, [t])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      console.log('[WatchLog] library:bootstrap:start')
      try {
        const [libraryResponse, explorerResponse] = await Promise.all([getLibrary(), getExplorer()])
        console.log('[WatchLog] library:bootstrap:response', {
          libraryResponse,
          explorerResponse,
        })
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

      console.log('[WatchLog] library:storage-change', { areaName, changes })

      try {
        const response = await getLibrary()
        console.log('[WatchLog] library:storage-refresh', response.snapshot.lists)
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

  const selectedDraft = selectedEntry
    ? drafts[selectedEntry.catalog.id] ?? {
        notes: selectedEntry.activity.manualNotes,
        progressText: selectedEntry.activity.currentProgress.progressText,
        listId: selectedEntry.activity.status,
        favorite: selectedEntry.activity.favorite,
      }
    : null
  const activeOverlay = activeListSettings ? 'list' : selectedEntry ? 'entry' : null

  const typeOptions = Array.from(new Set(entries.map((entry) => entry.catalog.mediaType))).sort()
  const sourceOptions = Array.from(
    new Set(entries.map((entry) => entry.activity.lastSource?.siteName ?? 'Unknown')),
  ).sort()

  function updateDraft(patch: Partial<{ notes: string; progressText: string; listId: string; favorite: boolean }>): void {
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
    console.log('[WatchLog] handleAddList:start', {
      label: newListLabel,
      selectedViewId,
      currentLists: snapshot.lists,
    })
    try {
      const response = await addList(newListLabel.trim())
      console.log('[WatchLog] handleAddList:response', response)
      const libraryResponse = await getLibrary()
      console.log('[WatchLog] handleAddList:librarySnapshot', libraryResponse.snapshot.lists)
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
    setSelectedCatalogId(catalogId)
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

  async function handleSaveEntry(): Promise<void> {
    if (!selectedEntry || !selectedDraft) return
    const response = await updateEntry({
      catalogId: selectedEntry.catalog.id,
      listId: selectedDraft.listId,
      favorite: selectedDraft.favorite,
      manualNotes: selectedDraft.notes,
      progress: { progressText: selectedDraft.progressText },
    })
    setSnapshot(response.snapshot)
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

  async function handleExplorerAdd(item: MetadataCard): Promise<void> {
    const response = await addFromExplorer(item.id, 'library')
    setSnapshot(response.snapshot)
    setSelectedViewId('library')
    setSelectedCatalogId(response.entry.catalog.id)
    setStatusMessageState({
      key: 'library.addedToLibrary',
      params: { title: item.title },
    })
  }

  const statusMessage = t(statusMessageState.key, statusMessageState.params)
  const showTopbarError = statusMessageState.key === 'library.errorWithReason'

  return (
    <div className="sidepanel-shell library-shell">
      <aside className="library-sidebar">
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
              onClick={() => setSelectedViewId(view.id)}
            >
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
                  onClick={() => setSelectedViewId(list.id)}
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
                    <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                      <option value="all">{t('library.typeAll')}</option>
                      {typeOptions.map((mediaType) => (
                        <option key={mediaType} value={mediaType}>
                          {`${t('library.typePrefix')}: ${getLocalizedMediaTypeLabel(
                            mediaType as LibraryEntry['catalog']['mediaType'],
                            t,
                          )}`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="library-filter-chip">
                    <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
                      <option value="all">{t('library.platformAny')}</option>
                      {sourceOptions.map((source) => (
                        <option key={source} value={source}>
                          {`${t('library.platformPrefix')}: ${
                            source === 'Unknown' ? t('common.unknown') : source
                          }`}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
            </div>

            <div className="library-filter-group">
              {selectedViewId !== EXPLORER_TAB_ID ? (
                <label className="library-filter-chip">
                  <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                    <option value="recent">{t('library.sortRecents')}</option>
                    <option value="title">{t('library.sortTitle')}</option>
                    <option value="progress">{t('library.sortProgress')}</option>
                  </select>
                </label>
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
            <section className="library-grid">
              {explorerItems.map((item) => (
                <article className="library-card explorer-card" key={item.id}>
                  <div className="library-card-poster-wrap">
                    <img className="library-card-poster" src={item.poster ?? getTemporaryPoster(item.normalizedTitle)} alt={item.title} />
                    <span className="library-card-overlay" />
                    <div className="library-card-badges">
                      <span className="media-badge tone-default">
                        {getLocalizedMediaTypeLabel(item.mediaType, t)}
                      </span>
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
                    <p className="library-card-description">{item.description}</p>
                    <button className="button" type="button" onClick={() => void handleExplorerAdd(item)}>
                      {t('library.addToLibrary')}
                    </button>
                  </div>
                </article>
              ))}
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
                  const tone = getStatusTone(entry.activity.status, entry.activity.favorite)
                  const progress = getProgressPercent(entry)
                  const platform = entry.activity.lastSource?.siteName ?? t('library.manualEntry')

                  return (
                    <article
                      key={entry.catalog.id}
                      className={`library-card ${selectedEntry?.catalog.id === entry.catalog.id ? 'is-selected' : ''}`}
                      onClick={() => handleSelectEntry(entry.catalog.id)}
                    >
                      <div className="library-card-poster-wrap">
                        <img className="library-card-poster" src={entry.catalog.poster ?? getTemporaryPoster(entry.catalog.normalizedTitle)} alt={entry.catalog.title} />
                        <span className="library-card-overlay" />
                        <div className="library-card-badges">
                          <span className={`media-badge tone-${tone}`}>
                            {getLocalizedMediaTypeLabel(entry.catalog.mediaType, t)}
                          </span>
                          {entry.activity.favorite ? <span className="favorite-badge">{t('common.favorite')}</span> : null}
                        </div>
                        <div className="library-card-progress">
                          <div className="library-card-progress-copy">
                            <span>
                              {entry.activity.status === 'completed'
                                ? t('library.completedTrack')
                                : t('library.activeTrack')}
                            </span>
                            <span>{progress > 0 ? `${progress}%` : entry.activity.currentProgress.progressText}</span>
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
                        <p className="library-card-description">{entry.activity.currentProgress.progressText}</p>
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

      <aside className={`entry-detail-drawer ${selectedEntry ? 'is-open' : ''}`}>
        {selectedEntry && selectedDraft ? (
          <>
            <div className="entry-detail-header">
                <div className="entry-detail-badges">
                <span className={`media-badge tone-${getStatusTone(selectedEntry.activity.status, selectedDraft.favorite)}`}>
                  {getLocalizedMediaTypeLabel(selectedEntry.catalog.mediaType, t)}
                </span>
                <span className="media-badge tone-planned">
                  {getLocalizedListLabel(snapshot.lists, selectedEntry.activity.status, t)}
                </span>
              </div>
              <button
                className={`favorite-toggle-chip ${selectedDraft.favorite ? 'is-active' : ''}`}
                type="button"
                onClick={() => void handleToggleFavorite()}
              >
                {selectedDraft.favorite ? t('library.favoriteEnabled') : t('library.markFavorite')}
              </button>
            </div>

            <div className="entry-detail-body">
              <div className="entry-detail-poster-wrap">
                <div className="entry-detail-poster-glow" />
                <div className="entry-detail-poster-card">
                  <img
                    className="entry-detail-poster"
                    src={selectedEntry.catalog.poster ?? getTemporaryPoster(selectedEntry.catalog.normalizedTitle)}
                    alt={selectedEntry.catalog.title}
                  />
                  <span className="entry-detail-status-pill">
                    {getLocalizedListLabel(snapshot.lists, selectedEntry.activity.status, t)}
                  </span>
                </div>
              </div>

              <div className="entry-detail-title-block">
                <h3 className="entry-detail-title">{selectedEntry.catalog.title}</h3>
                <p className="entry-detail-platform">
                  {t('library.detectedOn', {
                    site: selectedEntry.activity.lastSource?.siteName ?? t('library.manualEntry'),
                  })}
                </p>
              </div>

              <div className="entry-progress-module">
                <div className="entry-progress-head">
                  <div className="entry-progress-main">
                    <span className="entry-progress-label">{t('library.entryProgressModule')}</span>
                    <div className="entry-progress-numbers">
                      <strong>{getProgressCurrentValue(selectedEntry)}</strong>
                      <span>/ {getProgressTotalValue(selectedEntry)}</span>
                    </div>
                  </div>
                  <div className="entry-progress-side">
                    <span className="entry-progress-label">{t('popup.progressLabel')}</span>
                    <div className="entry-progress-side-value">
                      {getRemainingUnits(selectedEntry) !== null
                        ? t('library.entryRemaining', {
                            count: getRemainingUnits(selectedEntry) ?? 0,
                          })
                        : selectedEntry.activity.currentProgress.progressText}
                    </div>
                  </div>
                </div>
                <div className="entry-progress-track">
                  <div
                    className="entry-progress-value"
                    style={{ width: `${getProgressPercent(selectedEntry)}%` }}
                  />
                </div>
              </div>

              <div className="entry-detail-actions-stack">
                <button className="button" type="button" onClick={handleSaveEntry}>
                  {t('library.saveChanges')}
                </button>
                {selectedEntry.activity.lastSource?.url ? (
                  <a
                    className="button secondary"
                    href={selectedEntry.activity.lastSource.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {t('library.resumeSource')}
                  </a>
                ) : null}
              </div>

              <div className="entry-detail-grid">
                <div className="field-card">
                  <label className="label" htmlFor="entry-list">
                    {t('library.primaryList')}
                  </label>
                  <select
                    id="entry-list"
                    className="select"
                    value={selectedDraft.listId}
                    onChange={(event) => updateDraft({ listId: event.target.value })}
                  >
                    {snapshot.lists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {getLocalizedListDefinitionLabel(list, t)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field-card">
                  <label className="label" htmlFor="entry-progress">
                    {t('popup.progressLabel')}
                  </label>
                  <input
                    id="entry-progress"
                    className="field"
                    value={selectedDraft.progressText}
                    onChange={(event) => updateDraft({ progressText: event.target.value })}
                  />
                </div>
                <div className="field-card field-card-wide">
                  <label className="label" htmlFor="entry-notes">
                    {t('library.notes')}
                  </label>
                  <textarea
                    id="entry-notes"
                    className="textarea"
                    value={selectedDraft.notes}
                    onChange={(event) => updateDraft({ notes: event.target.value })}
                  />
                </div>
              </div>

              <div className="field-card entry-technical-block">
                <p className="library-detail-kicker">{t('library.entryTechnicalDetails')}</p>
                <div className="entry-technical-grid">
                  <div>
                    <span className="entry-technical-label">{t('library.primaryList')}</span>
                    <strong>{getLocalizedListLabel(snapshot.lists, selectedEntry.activity.status, t)}</strong>
                  </div>
                  <div>
                    <span className="entry-technical-label">{t('popup.progressLabel')}</span>
                    <strong>{selectedEntry.activity.currentProgress.progressText}</strong>
                  </div>
                  <div>
                    <span className="entry-technical-label">{t('library.listItemCount')}</span>
                    <strong>{selectedEntry.catalog.genres.length > 0 ? selectedEntry.catalog.genres.join(', ') : t('library.noMetadataYet')}</strong>
                  </div>
                  <div>
                    <span className="entry-technical-label">{t('common.search')}</span>
                    <strong>{selectedEntry.activity.lastSource?.pageTitle ?? t('common.unknown')}</strong>
                  </div>
                </div>
              </div>

              <div className="field-card entry-history-block">
                <div className="entry-history-head">
                  <p className="library-detail-kicker">{t('library.entryHistory')}</p>
                  <button
                    className="list-settings-close"
                    type="button"
                    aria-label={t('library.entryClosePanel')}
                    onClick={() => setSelectedCatalogId(null)}
                  >
                    <CloseIcon className="list-settings-close-icon" />
                  </button>
                </div>
                <div className="history-table">
                  {selectedEntry.activity.sourceHistory.length === 0 ? (
                    <p className="library-detail-copy">{t('library.entryNoHistory')}</p>
                  ) : (
                    selectedEntry.activity.sourceHistory.map((source) => (
                      <a
                        key={source.id}
                        className="history-row"
                        href={source.url || '#'}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <div className="history-site">
                          {source.favicon ? <img src={source.favicon} alt="" /> : null}
                          <div>
                            <strong>{source.siteName}</strong>
                            <span>{source.progressText}</span>
                          </div>
                        </div>
                        <span className="history-date">
                          {formatLocalizedDate(source.detectedAt, locale)}
                        </span>
                      </a>
                    ))
                  )}
                </div>
              </div>

              <div className="field-card list-settings-section list-settings-danger">
                <p className="list-settings-action-copy">
                  {t('library.deleteItemConfirmBody', { title: selectedEntry.catalog.title })}
                </p>
                <button className="button danger" type="button" onClick={handleRequestDeleteEntry}>
                  {t('library.deleteItem')}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </aside>

      <div
        className={`list-settings-scrim ${activeOverlay ? 'is-visible' : ''}`}
        aria-hidden="true"
        onClick={() => {
          setActiveListSettingsId(null)
          setSelectedCatalogId(null)
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
    </div>
  )
}
