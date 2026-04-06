import { startTransition, useEffect, useState } from 'react'
import { addFromExplorer, addList, getExplorer, getLibrary, updateEntry } from '../shared/client'
import { EXPLORER_TAB_ID } from '../shared/constants'
import { toLibraryEntries } from '../shared/selectors'
import { getTemporaryPoster } from '../shared/mock-posters'
import type { LibraryEntry, MetadataCard, WatchLogSnapshot } from '../shared/types'
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

function getStatusTone(status: string, favorite: boolean): string {
  if (favorite) return 'favorite'
  if (status === 'watching') return 'watching'
  if (status === 'completed') return 'completed'
  if (status === 'paused') return 'paused'
  if (status === 'library') return 'planned'
  if (status === 'planned') return 'planned'
  return 'default'
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
  const [drafts, setDrafts] = useState<Record<string, { notes: string; progressText: string; listId: string; favorite: boolean }>>({})
  const [statusMessageState, setStatusMessageState] = useState<{
    key:
      | 'library.loading'
      | 'library.ready'
      | 'library.listCreated'
      | 'library.listCreateFailed'
      | 'library.entryUpdated'
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
      const [libraryResponse, explorerResponse] = await Promise.all([getLibrary(), getExplorer()])
      if (cancelled) return
      startTransition(() => {
        setSnapshot(libraryResponse.snapshot)
        setExplorerItems(explorerResponse.items)
        setStatusMessageState({ key: 'library.ready' })
      })
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const entries = toLibraryEntries(snapshot)
  const primaryViews = [
    { id: ALL_TITLES_VIEW_ID, label: t('views.allTitles'), icon: 'LB' },
    { id: 'watching', label: t('lists.watching'), icon: 'PL' },
    { id: 'completed', label: t('lists.completed'), icon: 'OK' },
    { id: FAVORITES_VIEW_ID, label: t('views.favorites'), icon: 'FV' },
    { id: EXPLORER_TAB_ID, label: t('views.explorer'), icon: 'EX' },
  ]
  const queueLists = snapshot.lists.filter((list) => !['watching', 'completed'].includes(list.id))
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
    entries.find((entry) =>
      filteredEntries.some((candidate) => candidate.catalog.id === (selectedCatalogId ?? filteredEntries[0]?.catalog.id)) &&
      entry.catalog.id === (selectedCatalogId ?? filteredEntries[0]?.catalog.id),
    ) ?? null

  const selectedDraft = selectedEntry
    ? drafts[selectedEntry.catalog.id] ?? {
        notes: selectedEntry.activity.manualNotes,
        progressText: selectedEntry.activity.currentProgress.progressText,
        listId: selectedEntry.activity.status,
        favorite: selectedEntry.activity.favorite,
      }
    : null

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
    } catch {
      setStatusMessageState({ key: 'library.listCreateFailed' })
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
              <span className="library-nav-icon">{view.icon}</span>
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
              <button
                key={list.id}
                className={`queue-chip ${selectedViewId === list.id ? 'is-active' : ''}`}
                type="button"
                onClick={() => setSelectedViewId(list.id)}
              >
                {getLocalizedListDefinitionLabel(list, t)}
              </button>
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
          {t('common.settings')}
        </button>
      </aside>

      <div className="library-main">
        <header className="library-topbar">
          <div>
            <h2 className="library-topbar-title">{t('library.topbarTitle')}</h2>
            <p className="library-topbar-subtitle">{getViewDescription(selectedViewId, t)}</p>
          </div>
          <div className="library-topbar-actions">
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
            <LanguageSelect className="library-language-select" compact />
            {selectedViewId === EXPLORER_TAB_ID ? (
              <button className="library-chip-button" type="button" onClick={() => void handleExplorerSearch()}>
                {t('library.searchAction')}
              </button>
            ) : (
              <span className="library-status-chip">{statusMessage}</span>
            )}
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
                      <p className="library-card-source">{t('library.mockCatalog')}</p>
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
                      onClick={() => setSelectedCatalogId(entry.catalog.id)}
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

              {selectedEntry && selectedDraft ? (
                <section className="panel library-detail-panel">
                  <div className="library-detail-head">
                    <div>
                      <p className="library-detail-kicker">{t('library.focusedDetail')}</p>
                      <h3 className="library-detail-title">{selectedEntry.catalog.title}</h3>
                      <p className="library-detail-copy">
                        {selectedEntry.catalog.description ?? t('library.noMetadataYet')}
                      </p>
                    </div>
                    <div className="library-detail-pill-row">
                      <span className="library-status-chip">
                        {getLocalizedMediaTypeLabel(selectedEntry.catalog.mediaType, t)}
                      </span>
                      <span className="library-status-chip">{selectedEntry.activity.currentProgress.progressText}</span>
                    </div>
                  </div>

                  <div className="library-detail-grid">
                    <div className="field-card">
                      <label className="label" htmlFor="entry-list">{t('library.primaryList')}</label>
                      <select id="entry-list" className="select" value={selectedDraft.listId} onChange={(event) => updateDraft({ listId: event.target.value })}>
                        {snapshot.lists.map((list) => (
                          <option key={list.id} value={list.id}>
                            {getLocalizedListDefinitionLabel(list, t)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field-card">
                      <label className="label" htmlFor="entry-progress">{t('popup.progressLabel')}</label>
                      <input id="entry-progress" className="field" value={selectedDraft.progressText} onChange={(event) => updateDraft({ progressText: event.target.value })} />
                    </div>
                    <div className="field-card field-card-wide">
                      <label className="label" htmlFor="entry-notes">{t('library.notes')}</label>
                      <textarea id="entry-notes" className="textarea" value={selectedDraft.notes} onChange={(event) => updateDraft({ notes: event.target.value })} />
                    </div>
                  </div>

                  <div className="library-detail-actions">
                    <button className="button" type="button" onClick={handleSaveEntry}>
                      {t('library.saveChanges')}
                    </button>
                    {selectedEntry.activity.lastSource?.url ? (
                      <a className="button secondary" href={selectedEntry.activity.lastSource.url} rel="noreferrer" target="_blank">
                        {t('library.resumeSource')}
                      </a>
                    ) : null}
                    <button
                      className={`favorite-toggle-chip ${selectedDraft.favorite ? 'is-active' : ''}`}
                      type="button"
                      onClick={() => updateDraft({ favorite: !selectedDraft.favorite })}
                    >
                      {selectedDraft.favorite ? t('library.favoriteEnabled') : t('library.markFavorite')}
                    </button>
                  </div>

                  <div className="history-table">
                    {selectedEntry.activity.sourceHistory.map((source) => (
                      <a key={source.id} className="history-row" href={source.url || '#'} rel="noreferrer" target="_blank">
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
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
