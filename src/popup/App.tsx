import { useEffect, useState } from 'react'
import { getActiveDetection, getLibrary, saveDetection } from '../shared/client'
import { getListLabel, toLibraryEntries } from '../shared/selectors'
import type { DetectionResult, WatchLogSnapshot } from '../shared/types'
import { normalizeTitle } from '../shared/utils/normalize'
import './popup.css'

function getInitialSnapshot(): WatchLogSnapshot {
  return {
    catalog: [],
    activity: [],
    lists: [],
  }
}

export function PopupApp() {
  const [detection, setDetection] = useState<DetectionResult | null>(null)
  const [snapshot, setSnapshot] = useState<WatchLogSnapshot>(getInitialSnapshot)
  const [selectedList, setSelectedList] = useState('watching')
  const [favorite, setFavorite] = useState(false)
  const [message, setMessage] = useState('Waiting for page analysis...')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void Promise.all([getActiveDetection(), getLibrary()]).then(([active, library]) => {
      setDetection(active.detection)
      setSnapshot(library.snapshot)
      setMessage(
        active.detection
          ? 'Suggestion ready. Review it before saving.'
          : 'No supported media detected on this tab yet.',
      )
    })
  }, [])

  async function handleSave(): Promise<void> {
    if (!detection) {
      return
    }

    setBusy(true)
    setMessage('Saving to WatchLog...')

    try {
      const response = await saveDetection({
        detection,
        listId: selectedList,
        favorite,
      })

      setSnapshot(response.snapshot)
      setMessage(`Saved under ${getListLabel(response.snapshot.lists, selectedList)}.`)
    } finally {
      setBusy(false)
    }
  }

  async function openSidePanel(): Promise<void> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.windowId !== undefined) {
      await chrome.sidePanel.open({ windowId: tab.windowId })
      window.close()
    }
  }

  const recentEntries = toLibraryEntries(snapshot).slice(0, 3)

  return (
    <div className="app-shell popup-shell">
      <div className="panel popup-card">
        <div className="popup-header">
          <div>
            <p className="tiny">WatchLog</p>
            <h1 className="popup-title">Capture current tab</h1>
          </div>
          <span className="chip">
            <span className="status-dot" />
            Local-first
          </span>
        </div>

        <p className="muted">{message}</p>

        {detection ? (
          <div className="popup-form">
            <div>
              <label className="label" htmlFor="title">
                Title
              </label>
              <input
                id="title"
                className="field"
                value={detection.title}
                onChange={(event) =>
                  setDetection({
                    ...detection,
                    title: event.target.value,
                    normalizedTitle: normalizeTitle(event.target.value),
                  })
                }
              />
            </div>

            <div className="popup-grid">
              <div>
                <label className="label" htmlFor="list">
                  List
                </label>
                <select
                  id="list"
                  className="select"
                  value={selectedList}
                  onChange={(event) => setSelectedList(event.target.value)}
                >
                  {snapshot.lists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor="progress">
                  Progress
                </label>
                <input
                  id="progress"
                  className="field"
                  value={detection.progressLabel}
                  onChange={(event) =>
                    setDetection({
                      ...detection,
                      progressLabel: event.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="row">
              <label className="chip" htmlFor="favorite">
                <input
                  id="favorite"
                  type="checkbox"
                  checked={favorite}
                  onChange={(event) => setFavorite(event.target.checked)}
                />
                Favorite
              </label>
              <span className="chip">{detection.sourceSite}</span>
              <span className="chip">{detection.progressLabel}</span>
            </div>

            <div className="tiny">{detection.url}</div>

            <div className="popup-footer">
              <button className="button" type="button" disabled={busy} onClick={handleSave}>
                Save suggestion
              </button>
              <button className="button secondary" type="button" onClick={openSidePanel}>
                Open panel
              </button>
            </div>
          </div>
        ) : (
          <div className="stack">
            <div className="chip">Fallback extractor is still running on dynamic pages.</div>
            <button className="button secondary" type="button" onClick={openSidePanel}>
              Open library
            </button>
          </div>
        )}

        <div className="popup-recent">
          <h2 className="section-title">Recent activity</h2>
          {recentEntries.length === 0 ? (
            <p className="tiny">Your library is empty. Save something from the current page.</p>
          ) : (
            recentEntries.map((entry) => (
              <div className="recent-item" key={entry.catalog.id}>
                <div>
                  <strong>{entry.catalog.title}</strong>
                  <div className="tiny">{getListLabel(snapshot.lists, entry.activity.status)}</div>
                </div>
                <div className="tiny">{entry.activity.currentProgress.progressText}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
