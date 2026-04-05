import { startTransition, useEffect, useState } from 'react'
import {
  addFromExplorer,
  addList,
  getExplorer,
  getLibrary,
  updateEntry,
} from '../shared/client'
import { EXPLORER_TAB_ID } from '../shared/constants'
import { getListLabel, toLibraryEntries } from '../shared/selectors'
import type { MetadataCard, WatchLogSnapshot } from '../shared/types'
import './sidepanel.css'

function getInitialSnapshot(): WatchLogSnapshot {
  return {
    catalog: [],
    activity: [],
    lists: [],
  }
}

export function SidePanelApp() {
  const [snapshot, setSnapshot] = useState<WatchLogSnapshot>(getInitialSnapshot)
  const [selectedListId, setSelectedListId] = useState('watching')
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null)
  const [explorerQuery, setExplorerQuery] = useState('')
  const [explorerItems, setExplorerItems] = useState<MetadataCard[]>([])
  const [newListLabel, setNewListLabel] = useState('')
  const [drafts, setDrafts] = useState<
    Record<
      string,
      {
        notes: string
        progressText: string
        listId: string
        favorite: boolean
      }
    >
  >({})
  const [statusMessage, setStatusMessage] = useState('Loading WatchLog library...')

  async function handleAddList(): Promise<void> {
    if (!newListLabel.trim()) {
      return
    }

    const response = await addList(newListLabel)
    setSnapshot(response.snapshot)
    setNewListLabel('')
    setStatusMessage(`List "${response.list.label}" created.`)
  }

  async function handleSaveEntry(): Promise<void> {
    if (!selectedEntry) {
      return
    }

    const draft = selectedDraft
    if (!draft) {
      return
    }

    const response = await updateEntry({
      catalogId: selectedEntry.catalog.id,
      listId: draft.listId,
      favorite: draft.favorite,
      manualNotes: draft.notes,
      progress: {
        progressText: draft.progressText,
      },
    })

    setSnapshot(response.snapshot)
    setDrafts((current) => {
      const next = { ...current }
      delete next[selectedEntry.catalog.id]
      return next
    })
    setStatusMessage('Entry updated.')
  }

  async function handleExplorerAdd(item: MetadataCard): Promise<void> {
    const response = await addFromExplorer(item.id, 'planned')
    setSnapshot(response.snapshot)
    setSelectedListId('planned')
    setSelectedCatalogId(response.entry.catalog.id)
    setStatusMessage(`${item.title} added to Por ver.`)
  }

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const [libraryResponse, explorerResponse] = await Promise.all([
        getLibrary(),
        getExplorer(),
      ])

      if (cancelled) {
        return
      }

      startTransition(() => {
        setSnapshot(libraryResponse.snapshot)
        setExplorerItems(explorerResponse.items)
        setStatusMessage('Library ready.')
      })
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const entries = toLibraryEntries(snapshot)
  const visibleEntries = entries.filter((entry) => {
    if (selectedListId === EXPLORER_TAB_ID) {
      return false
    }

    return entry.activity.status === selectedListId
  })

  const effectiveSelectedCatalogId = visibleEntries.some(
    (entry) => entry.catalog.id === selectedCatalogId,
  )
    ? selectedCatalogId
    : visibleEntries[0]?.catalog.id ?? null

  const selectedEntry =
    entries.find((entry) => entry.catalog.id === effectiveSelectedCatalogId) ?? null

  const selectedDraft = selectedEntry
    ? drafts[selectedEntry.catalog.id] ?? {
        notes: selectedEntry.activity.manualNotes,
        progressText: selectedEntry.activity.currentProgress.progressText,
        listId: selectedEntry.activity.status,
        favorite: selectedEntry.activity.favorite,
      }
    : null

  function updateDraft(
    patch: Partial<{
      notes: string
      progressText: string
      listId: string
      favorite: boolean
    }>,
  ): void {
    if (!selectedEntry || !selectedDraft) {
      return
    }

    setDrafts((current) => ({
      ...current,
      [selectedEntry.catalog.id]: {
        ...selectedDraft,
        ...patch,
      },
    }))
  }

  const listButtons = [
    ...snapshot.lists,
    { id: EXPLORER_TAB_ID, label: 'Explorer', kind: 'system' as const },
  ]

  return (
    <div className="app-shell sidepanel-shell">
      <div className="sidepanel-layout">
        <aside className="panel sidebar">
          <div className="brand-lockup">
            <img className="brand-icon" src="/icons/favicon-32x32.png" alt="WatchLog logo" />
            <p className="tiny">WatchLog</p>
          </div>
          <h1 className="section-title">Your queues</h1>
          <p className="muted">
            Track where you left off and re-open the latest source with one click.
          </p>

          <div className="nav-list">
            {listButtons.map((list) => {
              const count =
                list.id === EXPLORER_TAB_ID
                  ? explorerItems.length
                  : entries.filter((entry) => entry.activity.status === list.id).length

              return (
                <button
                  key={list.id}
                  className={`nav-button ${selectedListId === list.id ? 'active' : ''}`}
                  type="button"
                  onClick={() => setSelectedListId(list.id)}
                >
                  <strong>{list.label}</strong>
                  <div className="tiny">{count} items</div>
                </button>
              )
            })}
          </div>

          <div className="stack" style={{ marginTop: 16 }}>
            <div>
              <label className="label" htmlFor="new-list">
                Create custom list
              </label>
              <input
                id="new-list"
                className="field"
                value={newListLabel}
                placeholder="Weekend binge"
                onChange={(event) => setNewListLabel(event.target.value)}
              />
            </div>
            <button className="button secondary" type="button" onClick={handleAddList}>
              Add list
            </button>
          </div>
        </aside>

        <main className="panel content">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="brand-lockup">
                <img className="brand-icon" src="/icons/favicon-32x32.png" alt="WatchLog logo" />
                <p className="tiny">Workspace</p>
              </div>
              <h2 className="section-title">
                {selectedListId === EXPLORER_TAB_ID
                  ? 'Explorer mock catalog'
                  : getListLabel(snapshot.lists, selectedListId)}
              </h2>
            </div>
            <span className="chip">{statusMessage}</span>
          </div>

          {selectedListId === EXPLORER_TAB_ID ? (
            <div className="stack" style={{ marginTop: 16 }}>
              <div className="row">
                <input
                  className="field"
                  value={explorerQuery}
                  placeholder="Search mock catalog"
                  onChange={(event) => setExplorerQuery(event.target.value)}
                />
                <button
                    className="button secondary"
                    type="button"
                    onClick={() =>
                      void getExplorer(explorerQuery).then((response) => {
                        setExplorerItems(response.items)
                      })
                    }
                >
                  Search
                </button>
              </div>

              <div className="entry-grid">
                {explorerItems.map((item) => (
                  <article className="explorer-card" key={item.id}>
                    {item.poster ? (
                      <img className="explorer-poster" src={item.poster} alt={item.title} />
                    ) : null}
                    <div className="explorer-body">
                      <h3 className="entry-title">{item.title}</h3>
                      <div className="entry-meta">
                        {item.score ? <span className="chip">Score {item.score}</span> : null}
                        <span className="chip">{item.mediaType}</span>
                      </div>
                      <p className="tiny">{item.genres.join(' · ')}</p>
                      <p className="muted">{item.description}</p>
                      <button
                        className="button"
                        type="button"
                        onClick={() => void handleExplorerAdd(item)}
                      >
                        Add to Por ver
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : visibleEntries.length === 0 ? (
            <div className="stack" style={{ marginTop: 24 }}>
              <span className="chip">This list is empty.</span>
              <p className="muted">
                Save something from the popup or use Explorer to seed your library.
              </p>
            </div>
          ) : (
            <div className="entry-grid">
              {visibleEntries.map((entry) => (
                <article
                  className="entry-card"
                  key={entry.catalog.id}
                  onClick={() => setSelectedCatalogId(entry.catalog.id)}
                  style={{
                    outline:
                      selectedCatalogId === entry.catalog.id
                        ? '2px solid rgba(167, 139, 250, 0.65)'
                        : 'none',
                    cursor: 'pointer',
                  }}
                >
                  {entry.catalog.poster ? (
                    <img
                      className="entry-poster"
                      src={entry.catalog.poster}
                      alt={entry.catalog.title}
                    />
                  ) : null}
                  <div className="entry-body">
                    <h3 className="entry-title">{entry.catalog.title}</h3>
                    <div className="entry-meta">
                      <span className="chip">{entry.activity.currentProgress.progressText}</span>
                      {entry.activity.favorite ? <span className="chip">Favorite</span> : null}
                    </div>
                    <div className="tiny">{entry.activity.lastSource?.siteName ?? 'Manual entry'}</div>
                    <div className="tiny">{entry.catalog.genres.join(' · ')}</div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>

        <aside className="panel detail">
          {selectedEntry ? (
            <div className="stack">
              <div>
                <p className="tiny">Detail</p>
                <h2 className="section-title">{selectedEntry.catalog.title}</h2>
                <p className="muted">{selectedEntry.catalog.description ?? 'No metadata yet.'}</p>
              </div>

              <div className="row">
                <span className="chip">{selectedEntry.catalog.mediaType}</span>
                {selectedEntry.catalog.releaseYear ? (
                  <span className="chip">{selectedEntry.catalog.releaseYear}</span>
                ) : null}
                <span className="chip">{selectedEntry.activity.currentProgress.progressText}</span>
              </div>

              <div>
                <label className="label" htmlFor="entry-list">
                  Primary list
                </label>
                <select
                  id="entry-list"
                  className="select"
                  value={selectedDraft?.listId ?? selectedEntry.activity.status}
                  onChange={(event) => updateDraft({ listId: event.target.value })}
                >
                  {snapshot.lists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor="entry-progress">
                  Progress label
                </label>
                <input
                  id="entry-progress"
                  className="field"
                  value={selectedDraft?.progressText ?? selectedEntry.activity.currentProgress.progressText}
                  onChange={(event) => updateDraft({ progressText: event.target.value })}
                />
              </div>

              <div>
                <label className="label" htmlFor="entry-notes">
                  Notes
                </label>
                <textarea
                  id="entry-notes"
                  className="textarea"
                  value={selectedDraft?.notes ?? selectedEntry.activity.manualNotes}
                  onChange={(event) => updateDraft({ notes: event.target.value })}
                />
              </div>

              <label className="chip" htmlFor="detail-favorite">
                <input
                  id="detail-favorite"
                  type="checkbox"
                  checked={selectedDraft?.favorite ?? selectedEntry.activity.favorite}
                  onChange={(event) => updateDraft({ favorite: event.target.checked })}
                />
                Mark as favorite
              </label>

              <div className="sticky-actions">
                <button className="button" type="button" onClick={handleSaveEntry}>
                  Save changes
                </button>
                {selectedEntry.activity.lastSource?.url ? (
                  <a
                    className="button secondary"
                    href={selectedEntry.activity.lastSource.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Resume from last source
                  </a>
                ) : null}
              </div>

              <div>
                <p className="tiny">Source history</p>
                <table className="detail-history">
                  <thead>
                    <tr>
                      <th>Site</th>
                      <th>Progress</th>
                      <th>Visited</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEntry.activity.sourceHistory.map((source) => (
                      <tr key={source.id}>
                        <td>
                          <a
                            className="history-site"
                            href={source.url || '#'}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {source.favicon ? <img src={source.favicon} alt="" /> : null}
                            <span>{source.siteName}</span>
                          </a>
                        </td>
                        <td>{source.progressText}</td>
                        <td className="tiny">
                          {new Date(source.detectedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="stack">
              <p className="tiny">Detail</p>
              <h2 className="section-title">No item selected</h2>
              <p className="muted">
                Pick an entry from the current list or seed something from Explorer.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
