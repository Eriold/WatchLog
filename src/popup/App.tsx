import { useEffect, useState } from 'react'
import { getActiveDetection, getLibrary, saveDetection } from '../shared/client'
import { getListLabel, toLibraryEntries } from '../shared/selectors'
import type { DetectionResult, WatchLogSnapshot } from '../shared/types'
import type { DetectionDebugInfo } from '../shared/messages'
import {
  cleanTitle,
  getFavicon,
  inferMediaType,
  isPlaceholderTitle,
  parseProgress,
} from '../shared/detection/helpers'
import { normalizeTitle } from '../shared/utils/normalize'
import './popup.css'

function getInitialSnapshot(): WatchLogSnapshot {
  return {
    catalog: [],
    activity: [],
    lists: [],
  }
}

function getEmptyDebug(): DetectionDebugInfo {
  return {
    tabId: null,
    tabUrl: null,
    source: 'none',
  }
}

async function getPopupTargetTab(): Promise<chrome.tabs.Tab | null> {
  let tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  if (tabs.length === 0) {
    tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  }

  return tabs[0] ?? null
}

interface PopupInjectedPageSnapshot {
  href: string
  pageTitle: string
  bodyText: string
  firstH1: string | null
  playerResponseTitle: string | null
  ogTitle: string | null
  metaTitle: string | null
  itempropName: string | null
  youtubeHeading: string | null
}

function inferSourceSite(url: URL): string {
  const hostname = url.hostname

  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
    return 'YouTube'
  }

  if (hostname.includes('netflix.com')) {
    return 'Netflix'
  }

  if (hostname.includes('max.com')) {
    return 'Max'
  }

  if (hostname.includes('primevideo.com') || hostname.includes('amazon.com')) {
    return 'Prime Video'
  }

  return hostname.replace(/^www\./i, '')
}

function buildDetectionFromSnapshot(snapshot: PopupInjectedPageSnapshot): DetectionResult | null {
  const url = new URL(snapshot.href)
  const sourceSite = inferSourceSite(url)
  const rawTitle =
    snapshot.firstH1 ??
    snapshot.playerResponseTitle ??
    snapshot.youtubeHeading ??
    snapshot.ogTitle ??
    snapshot.metaTitle ??
    snapshot.itempropName ??
    snapshot.pageTitle

  const title = cleanTitle(rawTitle, sourceSite)
  if (!title || isPlaceholderTitle(title, sourceSite)) {
    return null
  }

  const parsed = parseProgress(`${rawTitle} ${snapshot.pageTitle} ${snapshot.bodyText}`)

  return {
    title,
    normalizedTitle: normalizeTitle(title),
    mediaType: inferMediaType(url, parsed, title),
    sourceSite,
    url: url.toString(),
    favicon: getFavicon(url),
    pageTitle: snapshot.pageTitle,
    season: parsed.season,
    episode: parsed.episode,
    episodeTotal: parsed.episodeTotal,
    chapter: parsed.chapter,
    chapterTotal: parsed.chapterTotal,
    progressLabel: parsed.progressLabel,
    confidence: 0.8,
  }
}

async function runPopupScriptedDetection(tabId: number): Promise<{
  detection: DetectionResult | null
  debug: DetectionDebugInfo
}> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const playerResponseTitle =
          (window as typeof window & {
            ytInitialPlayerResponse?: {
              videoDetails?: {
                title?: string
              }
            }
          }).ytInitialPlayerResponse?.videoDetails?.title ?? null
        const compact = (value: string) => value.replace(/\s+/g, ' ').trim()
        const getMeta = (property: string) =>
          document
            .querySelector(`meta[property="${property}"], meta[name="${property}"]`)
            ?.getAttribute('content')
            ?.trim() ?? null
        const getText = (selector: string) => {
          const text = document.querySelector(selector)?.textContent?.trim()
          return text ? compact(text) : null
        }

        let firstH1: string | null = null
        for (const heading of document.querySelectorAll('h1')) {
          const text = heading.textContent?.trim()
          if (text) {
            firstH1 = compact(text)
            break
          }
        }

        return {
          href: window.location.href,
          pageTitle: document.title,
          bodyText: compact(document.body?.innerText ?? '').slice(0, 8000),
          firstH1,
          playerResponseTitle: playerResponseTitle ? compact(playerResponseTitle) : null,
          ogTitle: getMeta('og:title'),
          metaTitle: getMeta('title'),
          itempropName:
            document.querySelector('meta[itemprop="name"]')?.getAttribute('content')?.trim() ??
            null,
          youtubeHeading:
            getText('ytd-watch-metadata h1') ??
            getText('#title h1') ??
            getText('h1.ytd-watch-metadata') ??
            getText('yt-formatted-string.style-scope.ytd-watch-metadata'),
        }
      },
    })

    const snapshot = (result?.result as PopupInjectedPageSnapshot | undefined) ?? null
    const detection = snapshot ? buildDetectionFromSnapshot(snapshot) : null

    return {
      detection,
      debug: {
        tabId,
        tabUrl: snapshot?.href ?? null,
        source: detection ? 'popup-scripting' : 'none',
        reason: detection ? undefined : 'popup-scripted-detection-returned-null',
      },
    }
  } catch {
    return {
      detection: null,
      debug: {
        tabId,
        tabUrl: null,
        source: 'none',
        reason: 'popup-scripted-detection-failed',
      },
    }
  }
}

export function PopupApp() {
  const [detection, setDetection] = useState<DetectionResult | null>(null)
  const [debug, setDebug] = useState<DetectionDebugInfo>(getEmptyDebug)
  const [snapshot, setSnapshot] = useState<WatchLogSnapshot>(getInitialSnapshot)
  const [selectedList, setSelectedList] = useState('watching')
  const [favorite, setFavorite] = useState(false)
  const [message, setMessage] = useState('Waiting for page analysis...')
  const [busy, setBusy] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [targetTabId, setTargetTabId] = useState<number | null>(null)

  async function loadDetection(forceRefresh = false): Promise<DetectionResult | null> {
    const tab = await getPopupTargetTab()
    const resolvedTabId = tab?.id ?? null
    setTargetTabId(resolvedTabId)

    if (resolvedTabId === null) {
      setDebug({
        tabId: null,
        tabUrl: tab?.url ?? tab?.pendingUrl ?? null,
        source: 'none',
        reason: 'popup-could-not-resolve-tab',
      })
      return null
    }

    if (forceRefresh) {
      const local = await runPopupScriptedDetection(resolvedTabId)
      setDebug({
        ...local.debug,
        tabUrl: local.debug.tabUrl ?? tab?.url ?? tab?.pendingUrl ?? null,
      })
      return local.detection
    }

    let latestDebug: DetectionDebugInfo = {
      tabId: resolvedTabId,
      tabUrl: tab?.url ?? tab?.pendingUrl ?? null,
      source: 'none',
      reason: 'waiting-for-detection',
    }

    for (let attempt = 0; attempt < 14; attempt += 1) {
      const active = await getActiveDetection(resolvedTabId)
      latestDebug = active.debug
      if (active.detection) {
        setDebug(active.debug)
        return active.detection
      }

      await new Promise((resolve) => window.setTimeout(resolve, 400))
    }

    const local = await runPopupScriptedDetection(resolvedTabId)
    if (local.detection) {
      setDebug({
        ...local.debug,
        tabUrl: local.debug.tabUrl ?? tab?.url ?? tab?.pendingUrl ?? null,
      })
      return local.detection
    }

    setDebug(
      local.debug.reason
        ? {
            ...local.debug,
            tabUrl: local.debug.tabUrl ?? tab?.url ?? tab?.pendingUrl ?? null,
          }
        : latestDebug,
    )
    return null
  }

  useEffect(() => {
    let cancelled = false

    async function loadPopupData(): Promise<void> {
      const [detectionResult, libraryResult] = await Promise.allSettled([
        loadDetection(false),
        getLibrary(),
      ])

      if (cancelled) {
        return
      }

      const activeDetection =
        detectionResult.status === 'fulfilled' ? detectionResult.value : null

      if (libraryResult.status === 'fulfilled') {
        setSnapshot(libraryResult.value.snapshot)
      }

      setDetection(activeDetection)

      if (activeDetection) {
        setMessage('Suggestion ready. Review it before saving.')
        return
      }

      if (detectionResult.status === 'rejected' || libraryResult.status === 'rejected') {
        setMessage('Could not analyze this tab yet. Reload the page and try again.')
        return
      }

      setMessage('No supported media detected on this tab yet.')
    }

    void loadPopupData()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleRetryAnalysis(): Promise<void> {
    setAnalyzing(true)
    setMessage('Reanalyzing current tab...')

    try {
      const activeDetection = await loadDetection(true)
      setDetection(activeDetection)
      setMessage(
        activeDetection
          ? 'Suggestion ready. Review it before saving.'
          : 'Still no supported media detected on this tab.',
      )
    } finally {
      setAnalyzing(false)
    }
  }

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
    const tab = await getPopupTargetTab()

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
            <div className="brand-lockup">
              <img className="brand-icon" src="/icons/favicon-32x32.png" alt="WatchLog logo" />
              <p className="tiny">WatchLog</p>
            </div>
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
            <div className="chip">Detection unavailable for this tab right now.</div>
            <div className="debug-box">
              <div><strong>Source:</strong> {debug.source}</div>
              <div><strong>Reason:</strong> {debug.reason ?? 'none'}</div>
              <div><strong>Tab:</strong> {debug.tabId ?? targetTabId ?? 'unknown'}</div>
              <div className="debug-url"><strong>URL:</strong> {debug.tabUrl ?? 'unknown'}</div>
            </div>
            <button
              className="button"
              type="button"
              disabled={analyzing}
              onClick={handleRetryAnalysis}
            >
              Reanalyze tab
            </button>
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
