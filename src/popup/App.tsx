import { useEffect, useState } from 'react'
import {
  getActiveDetection,
  getLibrary,
  resolveDetectionMetadata,
  saveDetection,
} from '../shared/client'
import { STORAGE_KEYS, SYSTEM_LISTS } from '../shared/constants'
import { findMatchingLibraryEntry, toLibraryEntries } from '../shared/selectors'
import { storageGet } from '../shared/storage/browser'
import type {
  DetectionResult,
  LibraryEntry,
  MetadataCard,
  WatchListDefinition,
  WatchLogSnapshot,
} from '../shared/types'
import type { DetectionDebugInfo } from '../shared/messages'
import {
  type FaviconCandidate,
  cleanTitle,
  getFavicon,
  inferMediaType,
  isPlaceholderTitle,
  parseProgress,
  resolveDetectedTitle,
} from '../shared/detection/helpers'
import { hydrateDetectionWithMetadata } from '../shared/metadata/detection-hydration'
import { normalizeTitle } from '../shared/utils/normalize'
import { getRandomTemporaryPoster, getTemporaryPoster } from '../shared/mock-posters'
import {
  getLocalizedListDefinitionLabel,
  getLocalizedListLabel,
  getLocalizedMediaTypeLabel,
  getSortedLocalizedLists,
} from '../shared/i18n/helpers'
import { useI18n } from '../shared/i18n/useI18n'
import { LanguageSelect } from '../shared/ui/LanguageSelect'
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

function mergePopupLists(lists: WatchListDefinition[]): WatchListDefinition[] {
  const map = new Map<string, WatchListDefinition>()

  for (const list of SYSTEM_LISTS) {
    map.set(list.id, { ...list })
  }

  for (const list of lists) {
    if (!map.has(list.id)) {
      map.set(list.id, list)
    }
  }

  return Array.from(map.values())
}

function buildPopupListOptions(
  snapshotLists: WatchListDefinition[],
  storedLists: WatchListDefinition[],
): WatchListDefinition[] {
  return mergePopupLists([...snapshotLists, ...storedLists])
}

async function readPopupLists(): Promise<WatchListDefinition[]> {
  const stored = await storageGet<WatchListDefinition[]>(
    chrome.storage.local,
    STORAGE_KEYS.lists,
    [],
  )

  return mergePopupLists(stored)
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
  faviconCandidates: FaviconCandidate[]
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

function buildDetectionFromSnapshot(
  snapshot: PopupInjectedPageSnapshot,
  tabFaviconUrl?: string | null,
): DetectionResult | null {
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
    favicon: getFavicon(url, {
      candidates: snapshot.faviconCandidates,
      tabFaviconUrl,
    }),
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
    const tab = await chrome.tabs.get(tabId).catch(() => null)
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
        const faviconCandidates = Array.from(document.querySelectorAll('link[rel]'))
          .map((link) => ({
            href: link.getAttribute('href')?.trim() ?? '',
            rel: link.getAttribute('rel')?.trim() ?? '',
            type: link.getAttribute('type')?.trim() ?? null,
            sizes: link.getAttribute('sizes')?.trim() ?? null,
          }))
          .filter((candidate) => {
            if (!candidate.href) {
              return false
            }

            const rel = candidate.rel.toLowerCase()
            return (
              rel.includes('icon') ||
              rel.includes('apple-touch-icon') ||
              rel.includes('mask-icon')
            )
          })

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
          faviconCandidates,
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
    const detection = snapshot
      ? buildDetectionFromSnapshot(snapshot, tab?.favIconUrl ?? null)
      : null

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
  const { locale, t } = useI18n()
  const [detection, setDetection] = useState<DetectionResult | null>(null)
  const [resolvedMetadata, setResolvedMetadata] = useState<MetadataCard | null>(null)
  const [debug, setDebug] = useState<DetectionDebugInfo>(getEmptyDebug)
  const [snapshot, setSnapshot] = useState<WatchLogSnapshot>(getInitialSnapshot)
  const [libraryHydrated, setLibraryHydrated] = useState(false)
  const [listOptions, setListOptions] = useState<WatchListDefinition[]>(() => mergePopupLists([]))
  const [selectedList, setSelectedList] = useState('library')
  const [favorite, setFavorite] = useState(false)
  const [messageState, setMessageState] = useState<{
    key:
      | 'common.loading'
      | 'popup.suggestionReady'
      | 'popup.analyzeFailed'
      | 'popup.noSupportedMedia'
      | 'popup.reanalyzing'
      | 'popup.stillNoSupportedMedia'
      | 'popup.saving'
      | 'popup.savedUnder'
    params?: Record<string, string>
  }>({ key: 'common.loading' })
  const [busy, setBusy] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [targetTabId, setTargetTabId] = useState<number | null>(null)
  const [capturePoster, setCapturePoster] = useState(() => getRandomTemporaryPoster())
  const [syncedDetectionSignature, setSyncedDetectionSignature] = useState<string | null>(null)

  useEffect(() => {
    document.title = t('titles.popup')
  }, [t])

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

  async function loadDetectionWithRetry(): Promise<DetectionResult | null> {
    const initialDetection = await loadDetection(false)
    if (initialDetection) {
      return initialDetection
    }

    await new Promise((resolve) => window.setTimeout(resolve, 1200))
    return loadDetection(true)
  }

  useEffect(() => {
    let cancelled = false

    void getLibrary()
      .then((response) => {
        if (cancelled) {
          return
        }

        setSnapshot(response.snapshot)
        setLibraryHydrated(true)
        setListOptions((current) => buildPopupListOptions(response.snapshot.lists, current))
      })
      .catch(() => {
        if (cancelled) {
          return
        }

        setLibraryHydrated(true)
        setMessageState({ key: 'popup.analyzeFailed' })
      })

    void readPopupLists()
      .then((lists) => {
        if (cancelled) {
          return
        }

        setListOptions(lists)
      })
      .catch(() => {
        if (cancelled) {
          return
        }

        setListOptions(mergePopupLists([]))
      })

    void loadDetectionWithRetry()
      .then((activeDetection) => {
        if (cancelled) {
          return
        }

        setDetection(activeDetection)
        setMessageState({
          key: activeDetection ? 'popup.suggestionReady' : 'popup.noSupportedMedia',
        })
      })
      .catch(() => {
        if (cancelled) {
          return
        }

        setMessageState({ key: 'popup.analyzeFailed' })
      })

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
        !(STORAGE_KEYS.lists in changes) &&
          !(STORAGE_KEYS.catalog in changes) &&
          !(STORAGE_KEYS.activity in changes)
      ) {
        return
      }

      const [response, lists] = await Promise.all([getLibrary(), readPopupLists()])
      setSnapshot(response.snapshot)
      setListOptions(buildPopupListOptions(response.snapshot.lists, lists))
      setLibraryHydrated(true)
    }

    chrome.storage.onChanged.addListener(handleStorageChange)

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [])

  useEffect(() => {
    const availableLists = getSortedLocalizedLists(
      listOptions,
      locale,
      t,
    )

    if (availableLists.length > 0 && !availableLists.some((list) => list.id === selectedList)) {
      const preferredDefault =
        availableLists.find((list) => list.id === 'library')?.id ?? availableLists[0].id
      setSelectedList(preferredDefault)
    }
  }, [listOptions, locale, selectedList, t])

  useEffect(() => {
    if (detection) {
      setCapturePoster(getRandomTemporaryPoster())
      setSyncedDetectionSignature(null)
    }
  }, [detection?.normalizedTitle])

  const matchedLibraryEntry = detection
    ? findMatchingLibraryEntry(snapshot, detection)
    : null

  useEffect(() => {
    let cancelled = false

    if (!detection || matchedLibraryEntry) {
      setResolvedMetadata(null)
      return () => {
        cancelled = true
      }
    }

    void resolveDetectionMetadata(detection)
      .then((metadata) => {
        if (cancelled) {
          return
        }

        setResolvedMetadata(metadata ?? null)

        if (!metadata) {
          return
        }

        setDetection((current) => {
          if (!current) {
            return current
          }

          const hydrated = hydrateDetectionWithMetadata(current, metadata)
          if (
            current.mediaType === hydrated.mediaType &&
            current.episodeTotal === hydrated.episodeTotal &&
            current.chapterTotal === hydrated.chapterTotal &&
            current.progressLabel === hydrated.progressLabel
          ) {
            return current
          }

          return hydrated
        })
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedMetadata(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    detection?.normalizedTitle,
    detection?.sourceSite,
    detection?.title,
    matchedLibraryEntry?.catalog.id,
  ])

  useEffect(() => {
    if (!detection || !libraryHydrated) {
      return
    }

    const signature = `${targetTabId ?? 'unknown'}:${detection.normalizedTitle}:${detection.mediaType}`
    if (syncedDetectionSignature === signature) {
      return
    }

    if (matchedLibraryEntry) {
      setSelectedList(matchedLibraryEntry.activity.status)
      setFavorite(matchedLibraryEntry.activity.favorite)

      if (
        matchedLibraryEntry.catalog.title !== detection.title ||
        matchedLibraryEntry.catalog.normalizedTitle !== detection.normalizedTitle ||
        matchedLibraryEntry.catalog.mediaType !== detection.mediaType
      ) {
        setDetection((current) => {
          if (!current) {
            return current
          }

          return {
            ...current,
            title: matchedLibraryEntry.catalog.title,
            normalizedTitle: matchedLibraryEntry.catalog.normalizedTitle,
            mediaType: matchedLibraryEntry.catalog.mediaType,
          }
        })
      }
    } else {
      setSelectedList('library')
      setFavorite(false)
    }

    setSyncedDetectionSignature(signature)
  }, [
    detection,
    libraryHydrated,
    matchedLibraryEntry,
    syncedDetectionSignature,
    targetTabId,
  ])

  async function handleRetryAnalysis(): Promise<void> {
    setAnalyzing(true)
    setMessageState({ key: 'popup.reanalyzing' })

    try {
      const activeDetection = await loadDetection(true)
      setDetection(activeDetection)
      setMessageState({
        key: activeDetection ? 'popup.suggestionReady' : 'popup.stillNoSupportedMedia',
      })
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleSave(): Promise<void> {
    if (!detection) {
      return
    }

    setBusy(true)
    setMessageState({ key: 'popup.saving' })

    try {
      const response = await saveDetection({
        detection,
        listId: selectedList,
        favorite,
        metadata: resolvedMetadata ?? undefined,
      })

      setSnapshot(response.snapshot)
      setListOptions((current) => buildPopupListOptions(response.snapshot.lists, current))
      setMessageState({
        key: 'popup.savedUnder',
        params: {
          label: getLocalizedListLabel(response.snapshot.lists, selectedList, t),
        },
      })
    } finally {
      setBusy(false)
    }
  }

  async function openSidePanel(): Promise<void> {
    await chrome.tabs.create({
      url: chrome.runtime.getURL('library.html'),
    })
    window.close()
  }

  const availableLists = getSortedLocalizedLists(
    buildPopupListOptions(snapshot.lists, listOptions),
    locale,
    t,
  )
  const recentEntries = toLibraryEntries(snapshot).slice(0, 3)
  const sourceHost = detection ? getHostnameLabel(detection.url) : ''
  const currentListLabel = getLocalizedListLabel(availableLists, selectedList, t)
  const captureProgressPercent = detection ? getDetectionProgressPercent(detection) : 0
  const activeSessionsLabel = t(
    recentEntries.length === 1 ? 'popup.activeSession.one' : 'popup.activeSession.other',
    { count: recentEntries.length },
  )
  const captureInitials = detection ? getTitleInitials(detection.title) : 'WL'
  const fallbackCapturePoster = detection
    ? matchedLibraryEntry?.catalog.poster ?? resolvedMetadata?.poster ?? capturePoster
    : '/mock-posters/poster-01.svg'
  const message = t(messageState.key, messageState.params)

  return (
    <div className="app-shell popup-shell">
      <div className="panel popup-card">
        <header className="popup-topbar">
          <div className="brand-lockup popup-brand">
            <img className="brand-icon" src="/icons/favicon-32x32.png" alt="WatchLog logo" />
            <div>
              <p className="tiny popup-brand-kicker">{t('common.appName')}</p>
              <strong className="popup-brand-name">{t('popup.quickPopup')}</strong>
            </div>
          </div>
          <div className="popup-topbar-actions">
            <span className="chip popup-mode-chip">
              <span className="status-dot" />
              {t('common.localFirst')}
            </span>
            <LanguageSelect className="popup-language-select" compact />
            <button
              className="icon-surface-button"
              type="button"
              title={t('popup.openFullLibrary')}
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
                  <p className="eyebrow">{t('popup.currentCapture')}</p>
                  <h1 className="popup-title">{t('popup.captureCurrentTab')}</h1>
                </div>
                <span className="section-chip">{sourceHost}</span>
              </div>

              <p className="muted popup-message">{message}</p>

              <article className="capture-card">
                <div className="capture-art">
                  <div className="capture-art-surface">
                    <img
                      className="capture-art-image"
                      src={fallbackCapturePoster}
                      alt={`${detection.title} temporary poster`}
                    />
                    <span className="capture-art-overlay" />
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
                      aria-label={
                        favorite ? t('popup.removeFromFavorites') : t('popup.addToFavorites')
                      }
                      aria-pressed={favorite}
                      onClick={() => setFavorite((value) => !value)}
                    >
                      <HeartIcon filled={favorite} />
                    </button>
                  </div>

                  <div className="popup-section">
                    <label className="label popup-compact-label" htmlFor="title">
                      {t('popup.titleLabel')}
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
                          ? t('popup.completePercent', { percent: captureProgressPercent })
                          : t('popup.awaitingProgress')}
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
                    <span className="status-pill">
                      {getLocalizedMediaTypeLabel(detection.mediaType, t)}
                    </span>
                    <span className="status-pill">{currentListLabel}</span>
                    <span className="status-pill status-pill-progress">{detection.progressLabel}</span>
                  </div>

                  <div className="popup-grid capture-controls">
                    <div className="control-panel">
                      <label className="label popup-compact-label" htmlFor="list">
                        {t('popup.listLabel')}
                      </label>
                      <select
                        id="list"
                        className="select"
                        value={selectedList}
                        onChange={(event) => setSelectedList(event.target.value)}
                      >
                        {availableLists.map((list) => (
                          <option key={list.id} value={list.id}>
                            {getLocalizedListDefinitionLabel(list, t)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="control-panel">
                      <label className="label popup-compact-label" htmlFor="progress">
                        {t('popup.progressLabel')}
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
                        <span className="source-label">{t('popup.capturedLink')}</span>
                        <strong className="source-host">{sourceHost}</strong>
                      </div>
                    </div>
                    <span className="link-chip">
                      <LaunchIcon />
                      {t('common.open')}
                    </span>
                  </a>
                </div>
              </article>

              <div className="popup-footer popup-primary-actions">
                <button className="button" type="button" disabled={busy} onClick={handleSave}>
                  {t('popup.saveSuggestion')}
                </button>
                <button className="button secondary" type="button" onClick={openSidePanel}>
                  {t('popup.openFullLibrary')}
                </button>
              </div>
            </section>
          </>
        ) : (
          <section className="popup-hero">
            <div className="popup-heading-row">
              <div>
                <p className="eyebrow">{t('popup.currentCapture')}</p>
                <h1 className="popup-title">{t('popup.captureCurrentTab')}</h1>
              </div>
              <span className="section-chip">{t('popup.noSignal')}</span>
            </div>

            <p className="muted popup-message">{message}</p>

            <div className="empty-capture-card">
              <div className="empty-capture-copy">
                <strong>{t('popup.detectionUnavailable')}</strong>
                <p className="tiny">{t('popup.detectionHint')}</p>
              </div>
              <div className="debug-box">
                <div>
                  <strong>{t('popup.debugSource')}:</strong> {debug.source}
                </div>
                <div>
                  <strong>{t('popup.debugReason')}:</strong> {debug.reason ?? t('popup.none')}
                </div>
                <div>
                  <strong>{t('popup.debugTab')}:</strong>{' '}
                  {debug.tabId ?? targetTabId ?? t('common.unknown')}
                </div>
                <div className="debug-url">
                  <strong>{t('popup.debugUrl')}:</strong> {debug.tabUrl ?? t('common.unknown')}
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
                {t('popup.reanalyzeTab')}
              </button>
              <button className="button secondary" type="button" onClick={openSidePanel}>
                {t('popup.openFullLibrary')}
              </button>
            </div>
          </section>
        )}

        <div className="popup-recent">
          <div className="section-heading">
            <div>
              <h2 className="section-title">{t('popup.continueWatching')}</h2>
              <p className="tiny">{t('popup.resumeLatest')}</p>
            </div>
            <span className="section-chip">{activeSessionsLabel}</span>
          </div>

          {recentEntries.length === 0 ? (
            <div className="recent-empty-card">
              <strong>{t('popup.noRecentActivity')}</strong>
              <p className="tiny">{t('popup.noRecentActivityHint')}</p>
            </div>
          ) : (
            recentEntries.map((entry) => (
              <article className="recent-card" key={entry.catalog.id}>
                <div className="recent-art">
                  <img
                    className="recent-art-image"
                    src={entry.catalog.poster ?? getTemporaryPoster(entry.catalog.normalizedTitle)}
                    alt={`${entry.catalog.title} poster`}
                  />
                  {!entry.catalog.poster ? (
                    <span className="recent-art-fallback">
                      {getTitleInitials(entry.catalog.title)}
                    </span>
                  ) : null}
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
                      {getLocalizedListLabel(snapshot.lists, entry.activity.status, t)}
                    </p>
                  </div>

                  <div className="recent-progress">
                    <div className="recent-progress-copy">
                      <span>
                        {getEntryProgressPercent(entry) > 0
                          ? t('popup.completePercent', { percent: getEntryProgressPercent(entry) })
                          : t('popup.recentlySaved')}
                      </span>
                      <span>{getLocalizedListLabel(snapshot.lists, entry.activity.status, t)}</span>
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
