import { useEffect, useState } from 'react'
import { getActiveDetection, getLibrary, saveDetection } from '../shared/client'
import { getListLabel, toLibraryEntries } from '../shared/selectors'
import type { DetectionResult, LibraryEntry, WatchLogSnapshot } from '../shared/types'
import type { DetectionDebugInfo } from '../shared/messages'
import {
  cleanTitle,
  getFavicon,
  inferMediaType,
  isPlaceholderTitle,
  parseProgress,
  resolveDetectedTitle,
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

function getHostnameLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return url
  }
}

function getMediaTypeLabel(mediaType: DetectionResult['mediaType']): string {
  switch (mediaType) {
    case 'movie':
      return 'Movie'
    case 'series':
      return 'Series'
    case 'anime':
      return 'Anime'
    case 'manga':
      return 'Manga'
    case 'novel':
      return 'Novel'
    case 'video':
      return 'Video'
    default:
      return 'Unknown'
  }
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`heart-icon ${filled ? 'is-filled' : ''}`}
    >
      <path d="M12 21.35 10.55 20C5.4 15.24 2 12.09 2 8.24 2 5.09 4.42 2.75 7.44 2.75c1.71 0 3.35.81 4.56 2.09 1.21-1.28 2.85-2.09 4.56-2.09C19.58 2.75 22 5.09 22 8.24c0 3.85-3.4 7-8.55 11.76L12 21.35Z" />
    </svg>
  )
}

function LaunchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="action-icon">
      <path
        d="M14 5h5v5m0-5-7 7M10 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function LibraryIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="action-icon">
      <path
        d="M5 5.75A2.75 2.75 0 0 1 7.75 3h8.5A2.75 2.75 0 0 1 19 5.75v12.5A2.75 2.75 0 0 1 16.25 21h-8.5A2.75 2.75 0 0 1 5 18.25V5.75Zm3 1.75h8m-8 4h8m-8 4h5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="play-icon">
      <path d="M8 6.5v11l9-5.5-9-5.5Z" fill="currentColor" />
    </svg>
  )
}

function getTitleInitials(title: string): string {
  const tokens = title
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
    .slice(0, 2)

  if (tokens.length === 0) {
    return 'WL'
  }

  return tokens.map((token) => token[0]?.toUpperCase() ?? '').join('')
}

function inferProgressPercent(
  progressText: string,
  episode?: number,
  episodeTotal?: number,
  chapter?: number,
  chapterTotal?: number,
): number {
  if (episode !== undefined && episodeTotal && episodeTotal > 0) {
    return Math.min(100, Math.max(0, Math.round((episode / episodeTotal) * 100)))
  }

  if (chapter !== undefined && chapterTotal && chapterTotal > 0) {
    return Math.min(100, Math.max(0, Math.round((chapter / chapterTotal) * 100)))
  }

  const percentMatch = progressText.match(/(\d{1,3})\s*%/)
  if (percentMatch) {
    return Math.min(100, Math.max(0, Number.parseInt(percentMatch[1], 10)))
  }

  return 0
}

function getDetectionProgressPercent(detection: DetectionResult): number {
  return inferProgressPercent(
    detection.progressLabel,
    detection.episode,
    detection.episodeTotal,
    detection.chapter,
    detection.chapterTotal,
  )
}

function getEntryProgressPercent(entry: LibraryEntry): number {
  const progress = entry.activity.currentProgress
  return inferProgressPercent(
    progress.progressText,
    progress.episode,
    progress.episodeTotal,
    progress.chapter,
    progress.chapterTotal,
  )
}

function buildDetectionFromSnapshot(snapshot: PopupInjectedPageSnapshot): DetectionResult | null {
  const url = new URL(snapshot.href)
  const sourceSite = inferSourceSite(url)
  const rawTitle = resolveDetectedTitle(sourceSite, [
    snapshot.firstH1,
    snapshot.playerResponseTitle,
    snapshot.youtubeHeading,
    snapshot.ogTitle,
    snapshot.metaTitle,
    snapshot.itempropName,
    snapshot.pageTitle,
  ])

  if (!rawTitle) {
    return null
  }

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

  useEffect(() => {
    if (snapshot.lists.length > 0 && !snapshot.lists.some((list) => list.id === selectedList)) {
      setSelectedList(snapshot.lists[0].id)
    }
  }, [selectedList, snapshot.lists])

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
  const sourceHost = detection ? getHostnameLabel(detection.url) : ''
  const currentListLabel = getListLabel(snapshot.lists, selectedList)
  const captureProgressPercent = detection ? getDetectionProgressPercent(detection) : 0
  const activeSessionsLabel = `${recentEntries.length} ${
    recentEntries.length === 1 ? 'active session' : 'active sessions'
  }`
  const captureInitials = detection ? getTitleInitials(detection.title) : 'WL'

  return (
    <div className="app-shell popup-shell">
      <div className="panel popup-card">
        <header className="popup-topbar">
          <div className="brand-lockup popup-brand">
            <img className="brand-icon" src="/icons/favicon-32x32.png" alt="WatchLog logo" />
            <div>
              <p className="tiny popup-brand-kicker">WatchLog</p>
              <strong className="popup-brand-name">Quick popup</strong>
            </div>
          </div>
          <div className="popup-topbar-actions">
            <span className="chip popup-mode-chip">
              <span className="status-dot" />
              Local-first
            </span>
            <button
              className="icon-surface-button"
              type="button"
              title="Open full library"
              onClick={openSidePanel}
            >
              <LibraryIcon />
            </button>
          </div>
        </header>

        {detection ? (
          <>
            <section className="popup-hero">
              <div className="popup-heading-row">
                <div>
                  <p className="eyebrow">Current capture</p>
                  <h1 className="popup-title">Capture current tab</h1>
                </div>
                <span className="section-chip">{sourceHost}</span>
              </div>

              <p className="muted popup-message">{message}</p>

              <article className="capture-card">
                <div className="capture-art">
                  <div className="capture-art-surface">
                    <span className="capture-site">{detection.sourceSite}</span>
                    <strong className="capture-initials">{captureInitials}</strong>
                    <span className="capture-play-badge">
                      <PlayIcon />
                    </span>
                    <img
                      className="capture-favicon-badge"
                      src={detection.favicon}
                      alt={`${sourceHost} favicon`}
                      onError={(event) => {
                        event.currentTarget.src = '/icons/favicon-16x16.png'
                      }}
                    />
                  </div>
                </div>

                <div className="capture-body">
                  <div className="capture-body-topline">
                    <span className="capture-host">{sourceHost}</span>
                    <button
                      className={`favorite-icon-button ${favorite ? 'is-active' : ''}`}
                      type="button"
                      aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
                      aria-pressed={favorite}
                      onClick={() => setFavorite((value) => !value)}
                    >
                      <HeartIcon filled={favorite} />
                    </button>
                  </div>

                  <div className="popup-section">
                    <label className="label popup-compact-label" htmlFor="title">
                      Title
                    </label>
                    <input
                      id="title"
                      className="field popup-title-field"
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

                  <div className="capture-progress-block">
                    <div className="capture-progress-copy">
                      <span>
                        {captureProgressPercent > 0
                          ? `${captureProgressPercent}% complete`
                          : 'Awaiting progress'}
                      </span>
                      <span>{detection.progressLabel}</span>
                    </div>
                    <div className="capture-progress-track">
                      <div
                        className="capture-progress-value"
                        style={{ width: `${captureProgressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="status-row capture-status-row">
                    <span className="status-pill">{getMediaTypeLabel(detection.mediaType)}</span>
                    <span className="status-pill">{currentListLabel}</span>
                    <span className="status-pill status-pill-progress">{detection.progressLabel}</span>
                  </div>

                  <div className="popup-grid capture-controls">
                    <div className="control-panel">
                      <label className="label popup-compact-label" htmlFor="list">
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

                    <div className="control-panel">
                      <label className="label popup-compact-label" htmlFor="progress">
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

                  <a
                    className="source-panel"
                    href={detection.url}
                    target="_blank"
                    rel="noreferrer"
                    title={detection.url}
                  >
                    <div className="source-main">
                      <img
                        className="source-favicon"
                        src={detection.favicon}
                        alt={`${sourceHost} favicon`}
                        onError={(event) => {
                          event.currentTarget.src = '/icons/favicon-16x16.png'
                        }}
                      />
                      <div className="source-copy">
                        <span className="source-label">Captured link</span>
                        <strong className="source-host">{sourceHost}</strong>
                      </div>
                    </div>
                    <span className="link-chip">
                      <LaunchIcon />
                      Open
                    </span>
                  </a>
                </div>
              </article>

              <div className="popup-footer popup-primary-actions">
                <button className="button" type="button" disabled={busy} onClick={handleSave}>
                  Save suggestion
                </button>
                <button className="button secondary" type="button" onClick={openSidePanel}>
                  Open full library
                </button>
              </div>
            </section>
          </>
        ) : (
          <section className="popup-hero">
            <div className="popup-heading-row">
              <div>
                <p className="eyebrow">Current capture</p>
                <h1 className="popup-title">Capture current tab</h1>
              </div>
              <span className="section-chip">No signal</span>
            </div>

            <p className="muted popup-message">{message}</p>

            <div className="empty-capture-card">
              <div className="empty-capture-copy">
                <strong>Detection unavailable for this tab right now.</strong>
                <p className="tiny">
                  Reanalyze the page or open the full library while the content finishes loading.
                </p>
              </div>
              <div className="debug-box">
                <div>
                  <strong>Source:</strong> {debug.source}
                </div>
                <div>
                  <strong>Reason:</strong> {debug.reason ?? 'none'}
                </div>
                <div>
                  <strong>Tab:</strong> {debug.tabId ?? targetTabId ?? 'unknown'}
                </div>
                <div className="debug-url">
                  <strong>URL:</strong> {debug.tabUrl ?? 'unknown'}
                </div>
              </div>
            </div>

            <div className="popup-footer popup-primary-actions">
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
          </section>
        )}

        <div className="popup-recent">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Continue watching</h2>
              <p className="tiny">Resume the latest entries from your local library.</p>
            </div>
            <span className="section-chip">{activeSessionsLabel}</span>
          </div>

          {recentEntries.length === 0 ? (
            <div className="recent-empty-card">
              <strong>No recent activity yet.</strong>
              <p className="tiny">Save something from the current page and it will appear here.</p>
            </div>
          ) : (
            recentEntries.map((entry) => (
              <article className="recent-card" key={entry.catalog.id}>
                <div className="recent-art">
                  {entry.catalog.poster ? (
                    <img
                      className="recent-art-image"
                      src={entry.catalog.poster}
                      alt={`${entry.catalog.title} poster`}
                    />
                  ) : (
                    <span className="recent-art-fallback">
                      {getTitleInitials(entry.catalog.title)}
                    </span>
                  )}
                  <span className="recent-art-overlay" />
                  <span className="recent-play-badge">
                    <PlayIcon />
                  </span>
                  {entry.activity.lastSource?.favicon ? (
                    <img
                      className="recent-source-badge"
                      src={entry.activity.lastSource.favicon}
                      alt={`${entry.activity.lastSource.siteName} favicon`}
                      onError={(event) => {
                        event.currentTarget.src = '/icons/favicon-16x16.png'
                      }}
                    />
                  ) : null}
                </div>

                <div className="recent-body">
                  <div>
                    <strong className="recent-title">{entry.catalog.title}</strong>
                    <p className="recent-subtitle">
                      {entry.activity.currentProgress.progressText} /{' '}
                      {getListLabel(snapshot.lists, entry.activity.status)}
                    </p>
                  </div>

                  <div className="recent-progress">
                    <div className="recent-progress-copy">
                      <span>
                        {getEntryProgressPercent(entry) > 0
                          ? `${getEntryProgressPercent(entry)}% complete`
                          : 'Recently saved'}
                      </span>
                      <span>{getListLabel(snapshot.lists, entry.activity.status)}</span>
                    </div>
                    <div className="recent-progress-track">
                      <div
                        className="recent-progress-value"
                        style={{ width: `${getEntryProgressPercent(entry)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
