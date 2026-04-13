import { useEffect, useState } from 'react'
import {
  addList,
  getActiveDetection,
  getLibrary,
  resolveDetectionMetadata,
  saveDetection,
} from '../shared/client'
import {
  extractOlympusBibliotecaCatalogSnapshot,
  isOlympusBibliotecaCatalogPage,
} from '../shared/catalog-import/olympusbiblioteca'
import {
  extractZonaTmoCatalogSnapshot,
  isZonaTmoCatalogPage,
} from '../shared/catalog-import/zonatmo'
import type { CatalogImportItem, CatalogImportSnapshot } from '../shared/catalog-import/types'
import { STORAGE_KEYS, SYSTEM_LISTS } from '../shared/constants'
import {
  findMatchingLibraryEntry,
  findMatchingLibraryEntryForMetadata,
  toLibraryEntries,
} from '../shared/selectors'
import { storageGet } from '../shared/storage/browser'
import type {
  DetectionResult,
  LibraryEntry,
  MediaType,
  MetadataCard,
  WatchListDefinition,
  WatchLogSnapshot,
} from '../shared/types'
import type { DetectionDebugInfo } from '../shared/messages'
import {
  buildDetectionFromScriptedSnapshot,
  SCRIPTED_TEXT_TITLE_SELECTORS,
  type ScriptedDetectionSnapshot,
} from '../shared/detection/scripted-snapshot'
import {
  hydrateDetectionWithMetadata,
  hydrateDetectionWithStoredProgress,
  shouldPreserveDetectedTitle,
} from '../shared/metadata/detection-hydration'
import { buildLibraryUrl } from '../shared/navigation'
import { getResolvedProgressState, isDetectionAlreadyTracked } from '../shared/progress'
import {
  isCatalogMetadataPending,
  isCatalogMetadataSynced,
} from '../shared/catalog-sync'
import { normalizeTitle } from '../shared/utils/normalize'
import {
  getRandomTemporaryPoster,
  getTemporaryPoster,
  hasTemporaryPoster,
} from '../shared/mock-posters'
import {
  getLocalizedProgressLabel,
  getLocalizedListDefinitionLabel,
  getLocalizedListLabel,
  getLocalizedMediaTypeLabel,
  getSortedLocalizedLists,
} from '../shared/i18n/helpers'
import { getDetectionTitleCandidates } from '../shared/detection/title-candidates'
import { getSiteTitleAliasCandidates } from '../shared/detection/site-title-aliases'
import { useI18n } from '../shared/i18n/useI18n'
import { CustomSelect } from '../shared/ui/CustomSelect'
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

interface PopupPosterCandidate {
  url: string
  label: string
  source: 'meta' | 'page'
  width?: number
  height?: number
  score: number
}

const CREATE_NEW_LIST_OPTION = '__create_new_list__'

interface CatalogImportProgressState {
  stage: 'queueing' | 'done' | 'error'
  processed: number
  total: number
  label?: string
  reason?: string
  summary?: {
    created: number
    moved: number
    reused: number
    omitted: number
  }
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

function OpenInNewIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="action-icon open-library-icon">
      <path
        d="M14 5h5v5m0-5-8.25 8.25M19 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
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

function JumpToLibraryIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="action-icon popup-title-jump-icon">
      <path
        d="M8 16 16 8M10 8h6v6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="action-icon popup-save-check-icon">
      <path
        d="m5.5 12.5 4.1 4.1L18.5 7.7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </svg>
  )
}

function SyncStatusGlyph({ synced, className }: { synced: boolean; className?: string }) {
  if (synced) {
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

function getPopupTitleSuggestions(
  detection: DetectionResult | null,
  metadata: MetadataCard | null,
  matchedEntry: LibraryEntry | null,
  siteAliases: string[],
): string[] {
  if (!detection) {
    return []
  }

  return getDetectionTitleCandidates(
    detection,
    metadata ?? matchedEntry?.catalog ?? null,
    siteAliases,
  )
}

function getPopupOtherTitles(
  primaryTitle: string,
  ...aliasGroups: Array<string[] | undefined>
): string[] {
  const primaryKey = normalizeTitle(primaryTitle)
  const seen = new Set<string>(primaryKey ? [primaryKey] : [])
  const aliases: string[] = []

  for (const group of aliasGroups) {
    for (const candidate of group ?? []) {
      const value = candidate.trim()
      const normalized = normalizeTitle(value)
      if (!value || !normalized || seen.has(normalized)) {
        continue
      }

      seen.add(normalized)
      aliases.push(value)
    }
  }

  return aliases
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

function findExistingListByLabel(
  lists: WatchListDefinition[],
  label: string,
  t: ReturnType<typeof useI18n>['t'],
): WatchListDefinition | undefined {
  const normalizedLabel = normalizeTitle(label)
  if (!normalizedLabel) {
    return undefined
  }

  return lists.find((list) => {
    const localized = normalizeTitle(getLocalizedListDefinitionLabel(list, t))
    const raw = normalizeTitle(list.label)
    return localized === normalizedLabel || raw === normalizedLabel
  })
}

function buildCatalogImportDetection(
  item: CatalogImportItem,
  sourceSite: string,
  listMediaType?: MediaType,
): DetectionResult {
  return {
    title: item.title,
    normalizedTitle: item.normalizedTitle,
    mediaType: listMediaType ?? item.mediaType,
    sourceSite,
    url: item.sourceUrl,
    favicon: `https://${sourceSite}/favicon.ico`,
    pageTitle: item.title,
    progressLabel: 'Sin progreso',
    confidence: 1,
  }
}

function inferCatalogListMediaType(items: CatalogImportItem[]): MediaType | undefined {
  const counts = new Map<MediaType, number>()

  for (const item of items) {
    if (item.mediaType === 'unknown') {
      continue
    }

    counts.set(item.mediaType, (counts.get(item.mediaType) ?? 0) + 1)
  }

  if (counts.size === 0) {
    return undefined
  }

  if (counts.size === 1) {
    return counts.keys().next().value
  }

  const ranked = Array.from(counts.entries()).sort((left, right) => right[1] - left[1])
  const [winner, winnerCount] = ranked[0]
  const [, runnerUpCount] = ranked[1]

  if (winnerCount === runnerUpCount) {
    return undefined
  }

  return winner
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

function hasEnoughStoredMetadata(entry: LibraryEntry): boolean {
  const { catalog } = entry
  const hasAniListId = Boolean(catalog.externalIds.anilist)
  const hasRealPoster =
    Boolean(catalog.poster && !hasTemporaryPoster(catalog.poster)) &&
    catalog.posterKind !== 'unofficial'
  const hasDescription = Boolean(catalog.description?.trim())
  const hasTechnicalMetadata = Boolean(
    catalog.publicationStatus ||
      catalog.startDate ||
      catalog.endDate ||
      catalog.releaseYear !== undefined ||
      catalog.score !== undefined ||
      catalog.episodeCount !== undefined ||
      catalog.chapterCount !== undefined ||
      catalog.genres.length > 0,
  )

  return hasAniListId && hasRealPoster && hasDescription && hasTechnicalMetadata
}

function shouldResolveMetadataForPopup(
  detection: DetectionResult | null,
  matchedEntry: LibraryEntry | null,
): boolean {
  if (!detection) {
    return false
  }

  if (!matchedEntry) {
    return true
  }

  const mediaType =
    matchedEntry.catalog.mediaType !== 'unknown'
      ? matchedEntry.catalog.mediaType
      : detection.mediaType

  if (!['anime', 'manga', 'manhwa', 'manhua'].includes(mediaType)) {
    return false
  }

  return !hasEnoughStoredMetadata(matchedEntry)
}

function hasStoredOfficialPoster(entry: LibraryEntry | null): boolean {
  const poster = entry?.catalog.poster

  if (!poster || hasTemporaryPoster(poster)) {
    return false
  }

  return entry.catalog.posterKind !== 'unofficial'
}

function getPreferredCapturePoster(
  matchedEntry: LibraryEntry | null,
  metadata: MetadataCard | null,
  unofficialPoster: string | null,
  fallbackPoster: string,
): string {
  const storedPoster = matchedEntry?.catalog.poster

  if (hasStoredOfficialPoster(matchedEntry) && storedPoster) {
    return storedPoster
  }

  if (metadata?.poster) {
    return metadata.poster
  }

  if (unofficialPoster) {
    return unofficialPoster
  }

  return storedPoster ?? fallbackPoster
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
  const progress = getResolvedProgressState(entry.activity.currentProgress, entry.activity.status, {
    episodeCount: entry.catalog.episodeCount,
    chapterCount: entry.catalog.chapterCount,
  })
  return inferProgressPercent(
    progress.progressText,
    progress.episode,
    progress.episodeTotal,
    progress.chapter,
    progress.chapterTotal,
  )
}

function getPopupEntryProgressText(
  entry: LibraryEntry,
  t: ReturnType<typeof useI18n>['t'],
): string {
  const progress = getResolvedProgressState(entry.activity.currentProgress, entry.activity.status, {
    episodeCount: entry.catalog.episodeCount,
    chapterCount: entry.catalog.chapterCount,
  })

  return getLocalizedProgressLabel(progress, t)
}

async function runPopupScriptedDetection(tabId: number): Promise<{
  detection: DetectionResult | null
  debug: DetectionDebugInfo
}> {
  try {
    const tab = await chrome.tabs.get(tabId).catch(() => null)
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      args: [SCRIPTED_TEXT_TITLE_SELECTORS],
      func: (textTitleSelectors) => {
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
        const titleCandidates: string[] = []
        const seenTitles = new Set<string>()
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

        for (const selector of textTitleSelectors) {
          const text = getText(selector)
          if (text && !seenTitles.has(text)) {
            seenTitles.add(text)
            titleCandidates.push(text)
          }
        }

        return {
          href: window.location.href,
          pageTitle: document.title,
          bodyText: compact(document.body?.innerText ?? '').slice(0, 8000),
          faviconCandidates,
          titleCandidates,
          playerResponseTitle: playerResponseTitle ? compact(playerResponseTitle) : null,
          ogTitle: getMeta('og:title'),
          metaTitle: getMeta('title'),
          itempropName:
            document.querySelector('meta[itemprop="name"]')?.getAttribute('content')?.trim() ??
            null,
        }
      },
    })

    const snapshot = (result?.result as ScriptedDetectionSnapshot | undefined) ?? null
    const detection = snapshot
      ? buildDetectionFromScriptedSnapshot(snapshot, tab?.favIconUrl ?? null)
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

async function runPopupPosterProbe(tabId: number): Promise<PopupPosterCandidate[]> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const normalizeUrl = (rawValue: string | null | undefined) => {
          const raw = rawValue?.trim()
          if (!raw) {
            return null
          }

          try {
            const url = new URL(raw, window.location.href).toString()
            return /^https?:/i.test(url) ? url : null
          } catch {
            return null
          }
        }

        const scoreCandidate = (candidate: {
          url: string
          label: string
          source: 'meta' | 'page'
          width?: number
          height?: number
          top?: number
        }) => {
          let score = candidate.source === 'meta' ? 28 : 10
          const ratio =
            candidate.width && candidate.height ? candidate.width / candidate.height : undefined

          if (ratio !== undefined) {
            if (ratio >= 0.55 && ratio <= 0.82) {
              score += 48
            } else if (ratio > 0.82 && ratio <= 1.05) {
              score += 28
            } else if (ratio > 1.05 && ratio <= 1.9) {
              score += 12
            } else {
              score -= 6
            }
          }

          if (candidate.height) {
            if (candidate.height >= 600) {
              score += 16
            } else if (candidate.height >= 320) {
              score += 8
            }
          }

          if (candidate.width && candidate.height && candidate.width * candidate.height >= 250000) {
            score += 10
          }

          if (candidate.top !== undefined) {
            score += Math.max(0, 12 - Math.min(12, Math.abs(candidate.top) / 100))
          }

          const hintText = `${candidate.url} ${candidate.label}`.toLowerCase()
          if (/\b(?:cover|poster|volume|book|manga|novel|key visual|art)\b/.test(hintText)) {
            score += 18
          }

          if (/\b(?:avatar|icon|logo|emoji|sprite|banner|ads?)\b/.test(hintText)) {
            score -= 36
          }

          return score
        }

        const deduped = new Map<
          string,
          {
            url: string
            label: string
            source: 'meta' | 'page'
            width?: number
            height?: number
            score: number
          }
        >()

        const pushCandidate = (candidate: {
          url?: string | null
          label: string
          source: 'meta' | 'page'
          width?: number
          height?: number
          top?: number
        }) => {
          const url = normalizeUrl(candidate.url)
          if (!url) {
            return
          }

          if (
            candidate.width !== undefined &&
            candidate.height !== undefined &&
            (candidate.width < 120 || candidate.height < 120)
          ) {
            return
          }

          const score = scoreCandidate({
            url,
            label: candidate.label,
            source: candidate.source,
            width: candidate.width,
            height: candidate.height,
            top: candidate.top,
          })

          const existing = deduped.get(url)
          if (!existing || score > existing.score) {
            deduped.set(url, {
              url,
              label: candidate.label,
              source: candidate.source,
              width: candidate.width,
              height: candidate.height,
              score,
            })
          }
        }

        const getMeta = (property: string) =>
          document
            .querySelector(`meta[property="${property}"], meta[name="${property}"]`)
            ?.getAttribute('content')
            ?.trim() ?? null

        const ogWidth = Number.parseInt(getMeta('og:image:width') ?? '', 10)
        const ogHeight = Number.parseInt(getMeta('og:image:height') ?? '', 10)

        pushCandidate({
          url: getMeta('og:image'),
          label: 'OG image',
          source: 'meta',
          width: Number.isFinite(ogWidth) ? ogWidth : undefined,
          height: Number.isFinite(ogHeight) ? ogHeight : undefined,
        })
        pushCandidate({
          url: getMeta('twitter:image'),
          label: 'Twitter image',
          source: 'meta',
        })
        pushCandidate({
          url: getMeta('twitter:image:src'),
          label: 'Twitter image',
          source: 'meta',
        })
        pushCandidate({
          url:
            document.querySelector('meta[itemprop="image"]')?.getAttribute('content')?.trim() ??
            null,
          label: 'Item image',
          source: 'meta',
        })
        pushCandidate({
          url: document.querySelector('link[rel="image_src"]')?.getAttribute('href')?.trim() ?? null,
          label: 'Linked image',
          source: 'meta',
        })

        for (const image of Array.from(document.images)) {
          const url = image.currentSrc || image.src
          if (!url) {
            continue
          }

          const alt = image.getAttribute('alt')?.trim() ?? ''
          const className = image.getAttribute('class')?.trim() ?? ''
          const rect = image.getBoundingClientRect()

          pushCandidate({
            url,
            label: alt || className || 'Page image',
            source: 'page',
            width: image.naturalWidth || rect.width || undefined,
            height: image.naturalHeight || rect.height || undefined,
            top: Number.isFinite(rect.top) ? rect.top : undefined,
          })
        }

        return Array.from(deduped.values())
          .sort((left, right) => {
            if (right.score !== left.score) {
              return right.score - left.score
            }

            return (right.height ?? 0) - (left.height ?? 0)
          })
          .slice(0, 3)
      },
    })

    return (result?.result as PopupPosterCandidate[] | undefined) ?? []
  } catch {
    return []
  }
}

async function runZonaTmoCatalogProbe(tabId: number): Promise<CatalogImportSnapshot | null> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractZonaTmoCatalogSnapshot,
    })

    return (result?.result as CatalogImportSnapshot | null | undefined) ?? null
  } catch {
    return null
  }
}

async function runOlympusBibliotecaCatalogProbe(
  tabId: number,
): Promise<CatalogImportSnapshot | null> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractOlympusBibliotecaCatalogSnapshot,
    })

    return (result?.result as CatalogImportSnapshot | null | undefined) ?? null
  } catch {
    return null
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
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle')
  const [analyzing, setAnalyzing] = useState(false)
  const [catalogImportBusy, setCatalogImportBusy] = useState(false)
  const [catalogImportScanBusy, setCatalogImportScanBusy] = useState(false)
  const [targetTabId, setTargetTabId] = useState<number | null>(null)
  const [targetTabUrl, setTargetTabUrl] = useState<string | null>(null)
  const [capturePoster, setCapturePoster] = useState(() => getRandomTemporaryPoster())
  const [posterCandidates, setPosterCandidates] = useState<PopupPosterCandidate[]>([])
  const [selectedPosterUrl, setSelectedPosterUrl] = useState<string | null>(null)
  const [syncedDetectionSignature, setSyncedDetectionSignature] = useState<string | null>(null)
  const [catalogImportSnapshot, setCatalogImportSnapshot] = useState<CatalogImportSnapshot | null>(null)
  const [catalogImportTarget, setCatalogImportTarget] = useState<string>(CREATE_NEW_LIST_OPTION)
  const [catalogImportNewListLabel, setCatalogImportNewListLabel] = useState('')
  const [catalogImportMergeConfirmed, setCatalogImportMergeConfirmed] = useState(false)
  const [catalogImportProgress, setCatalogImportProgress] = useState<CatalogImportProgressState | null>(null)
  const [catalogImportCompletedTarget, setCatalogImportCompletedTarget] = useState<{
    listId: string
    label: string
  } | null>(null)
  const [siteTitleAliases, setSiteTitleAliases] = useState<string[]>([])

  useEffect(() => {
    document.title = t('titles.popup')
  }, [t])

  async function loadDetection(forceRefresh = false): Promise<DetectionResult | null> {
    const tab = await getPopupTargetTab()
    const resolvedTabId = tab?.id ?? null
    const resolvedTabUrl = tab?.url ?? tab?.pendingUrl ?? null
    setTargetTabId(resolvedTabId)
    setTargetTabUrl(resolvedTabUrl)

    if (resolvedTabId === null) {
      setDebug({
        tabId: null,
        tabUrl: resolvedTabUrl,
        source: 'none',
        reason: 'popup-could-not-resolve-tab',
      })
      return null
    }

    if (forceRefresh) {
      const local = await runPopupScriptedDetection(resolvedTabId)
      setDebug({
        ...local.debug,
        tabUrl: local.debug.tabUrl ?? resolvedTabUrl,
      })
      return local.detection
    }

    let latestDebug: DetectionDebugInfo = {
      tabId: resolvedTabId,
      tabUrl: resolvedTabUrl,
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
        tabUrl: local.debug.tabUrl ?? resolvedTabUrl,
      })
      return local.detection
    }

    setDebug(
      local.debug.reason
        ? {
            ...local.debug,
            tabUrl: local.debug.tabUrl ?? resolvedTabUrl,
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
    let cancelled = false
    const currentTabUrl = targetTabUrl ?? ''

    const isCatalogPage =
      targetTabUrl !== null &&
      (isZonaTmoCatalogPage(currentTabUrl) || isOlympusBibliotecaCatalogPage(currentTabUrl))

    if (targetTabId === null || !isCatalogPage) {
      setCatalogImportSnapshot(null)
      setCatalogImportProgress(null)
      return () => {
        cancelled = true
      }
    }

    const probe = isZonaTmoCatalogPage(currentTabUrl)
      ? runZonaTmoCatalogProbe(targetTabId)
      : runOlympusBibliotecaCatalogProbe(targetTabId)

    void probe.then((result) => {
      if (cancelled) {
        return
      }

      setCatalogImportSnapshot(result)
      if (!result) {
        setCatalogImportProgress(null)
      }
    })

    return () => {
      cancelled = true
    }
  }, [targetTabId, targetTabUrl])

  useEffect(() => {
    if (!catalogImportSnapshot) {
      setCatalogImportTarget(CREATE_NEW_LIST_OPTION)
      setCatalogImportNewListLabel('')
      setCatalogImportMergeConfirmed(false)
      setCatalogImportCompletedTarget(null)
      return
    }

    setCatalogImportTarget(CREATE_NEW_LIST_OPTION)
    setCatalogImportNewListLabel(catalogImportSnapshot.listLabel)
    setCatalogImportMergeConfirmed(false)
    setCatalogImportCompletedTarget(null)
    setCatalogImportProgress(null)
  }, [catalogImportSnapshot?.sourceUrl])

  useEffect(() => {
    if (!catalogImportSnapshot) {
      return
    }

    const availableLists = getSortedLocalizedLists(
      buildPopupListOptions(snapshot.lists, listOptions),
      locale,
      t,
    )

    setCatalogImportTarget((current) => {
      const currentIsExistingList = availableLists.some((list) => list.id === current)
      if (currentIsExistingList || current === CREATE_NEW_LIST_OPTION) {
        return current
      }

      return CREATE_NEW_LIST_OPTION
    })
    setCatalogImportNewListLabel((current) =>
      current.trim() ? current : catalogImportSnapshot.listLabel,
    )
  }, [catalogImportSnapshot, snapshot.lists, listOptions, locale, t])

  useEffect(() => {
    setCatalogImportMergeConfirmed(false)

    if (!catalogImportBusy && catalogImportProgress?.stage === 'done') {
      setCatalogImportProgress(null)
      setCatalogImportCompletedTarget(null)
    }
  }, [catalogImportTarget, catalogImportNewListLabel, catalogImportBusy, catalogImportProgress?.stage])

  useEffect(() => {
    const availableLists = getSortedLocalizedLists(
      buildPopupListOptions(snapshot.lists, listOptions),
      locale,
      t,
    )

    if (availableLists.length > 0 && !availableLists.some((list) => list.id === selectedList)) {
      const preferredDefault =
        availableLists.find((list) => list.id === 'library')?.id ?? availableLists[0].id
      setSelectedList(preferredDefault)
    }
  }, [snapshot.lists, listOptions, locale, selectedList, t])

  useEffect(() => {
    if (detection) {
      setCapturePoster(getRandomTemporaryPoster())
      setSyncedDetectionSignature(null)
      setPosterCandidates([])
      setSelectedPosterUrl(null)
    }
  }, [detection?.normalizedTitle])

  useEffect(() => {
    let cancelled = false

    if (!detection) {
      setSiteTitleAliases([])
      return () => {
        cancelled = true
      }
    }

    void getSiteTitleAliasCandidates(detection.sourceSite, detection.title)
      .then((aliases) => {
        if (!cancelled) {
          setSiteTitleAliases(aliases)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSiteTitleAliases([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [detection?.sourceSite, detection?.title, detection?.normalizedTitle])

  useEffect(() => {
    let cancelled = false

    if (!detection || targetTabId === null) {
      setPosterCandidates([])
      setSelectedPosterUrl(null)
      return () => {
        cancelled = true
      }
    }

    void runPopupPosterProbe(targetTabId).then((candidates) => {
      if (cancelled) {
        return
      }

      setPosterCandidates(candidates)
      setSelectedPosterUrl((current) =>
        current && candidates.some((candidate) => candidate.url === current)
          ? current
          : candidates[0]?.url ?? null,
      )
    })

    return () => {
      cancelled = true
    }
  }, [detection?.normalizedTitle, targetTabId])

  const matchedLibraryEntryFromDetection = detection
    ? findMatchingLibraryEntry(snapshot, detection)
    : null
  const matchedLibraryEntryFromMetadata = resolvedMetadata
    ? findMatchingLibraryEntryForMetadata(snapshot, resolvedMetadata)
    : null
  const matchedLibraryEntry = matchedLibraryEntryFromMetadata ?? matchedLibraryEntryFromDetection
  const matchedLibraryEntryAlreadyTracked = matchedLibraryEntry
    ? isDetectionAlreadyTracked(
        matchedLibraryEntry.activity.currentProgress,
        matchedLibraryEntry.activity.status,
        detection ?? {
          season: undefined,
          episode: undefined,
          chapter: undefined,
        },
        {
          episodeCount: matchedLibraryEntry.catalog.episodeCount,
          chapterCount: matchedLibraryEntry.catalog.chapterCount,
        },
      )
    : false
  const shouldResolveMetadata = shouldResolveMetadataForPopup(
    detection,
    matchedLibraryEntryFromDetection,
  )
  const titleSuggestions = getPopupTitleSuggestions(
    detection,
    resolvedMetadata,
    matchedLibraryEntry,
    siteTitleAliases,
  )

  useEffect(() => {
    let cancelled = false

    if (!detection || !shouldResolveMetadata) {
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
          const nextDetection =
            matchedLibraryEntryFromDetection || shouldPreserveDetectedTitle(current.sourceSite)
            ? hydrated
            : {
                ...hydrated,
                title: metadata.title,
                normalizedTitle: metadata.normalizedTitle,
              }

          if (
            current.title === nextDetection.title &&
            current.normalizedTitle === nextDetection.normalizedTitle &&
            current.mediaType === nextDetection.mediaType &&
            current.episodeTotal === nextDetection.episodeTotal &&
            current.chapterTotal === nextDetection.chapterTotal &&
            current.progressLabel === nextDetection.progressLabel
          ) {
            return current
          }

          return nextDetection
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
    matchedLibraryEntryFromDetection?.catalog.updatedAt,
    matchedLibraryEntryFromDetection?.catalog.id,
    shouldResolveMetadata,
  ])

  useEffect(() => {
    if (!detection || !libraryHydrated) {
      setSaveState('idle')
      return
    }

    const signature = `${targetTabId ?? 'unknown'}:${detection.normalizedTitle}:${detection.mediaType}`
    if (syncedDetectionSignature === signature) {
      return
    }

    setSaveState(matchedLibraryEntryAlreadyTracked ? 'saved' : 'idle')

    if (matchedLibraryEntry) {
      setSelectedList(matchedLibraryEntry.activity.status)
      setFavorite(matchedLibraryEntry.activity.favorite)

      const shouldPreserveSourceTitle = shouldPreserveDetectedTitle(detection.sourceSite)
      const hydratedDetection = hydrateDetectionWithStoredProgress(
        shouldPreserveSourceTitle
          ? detection
          : {
              ...detection,
              title: matchedLibraryEntry.catalog.title,
              normalizedTitle: matchedLibraryEntry.catalog.normalizedTitle,
              mediaType: matchedLibraryEntry.catalog.mediaType,
            },
        getResolvedProgressState(
          matchedLibraryEntry.activity.currentProgress,
          matchedLibraryEntry.activity.status,
          {
            episodeCount: matchedLibraryEntry.catalog.episodeCount,
            chapterCount: matchedLibraryEntry.catalog.chapterCount,
          },
        ),
      )

      if (
        hydratedDetection.title !== detection.title ||
        hydratedDetection.normalizedTitle !== detection.normalizedTitle ||
        hydratedDetection.mediaType !== detection.mediaType ||
        hydratedDetection.season !== detection.season ||
        hydratedDetection.episode !== detection.episode ||
        hydratedDetection.episodeTotal !== detection.episodeTotal ||
        hydratedDetection.chapter !== detection.chapter ||
        hydratedDetection.chapterTotal !== detection.chapterTotal ||
        hydratedDetection.progressLabel !== detection.progressLabel
      ) {
        setDetection((current) => {
          if (!current) {
            return current
          }

          return {
            ...current,
            ...hydratedDetection,
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
    matchedLibraryEntryAlreadyTracked,
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
        posterOverride: selectedUnofficialPoster ?? undefined,
      })

      setSnapshot(response.snapshot)
      setListOptions((current) => buildPopupListOptions(response.snapshot.lists, current))
      setSaveState('saved')
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

  const saveButtonLabel = saveState === 'saved'
    ? 'Progreso actualizado'
    : matchedLibraryEntry
      ? t('popup.saveProgress')
      : t('popup.saveSuggestion')

  async function resolveCatalogImportList(): Promise<{ listId: string; label: string }> {
    const availableLists = getSortedLocalizedLists(
      buildPopupListOptions(snapshot.lists, listOptions),
      locale,
      t,
    )

    if (catalogImportTarget !== CREATE_NEW_LIST_OPTION) {
      const existingList = availableLists.find((list) => list.id === catalogImportTarget)
      return {
        listId: existingList?.id ?? catalogImportTarget,
        label: existingList
          ? getLocalizedListDefinitionLabel(existingList, t)
          : getLocalizedListLabel(availableLists, catalogImportTarget, t),
      }
    }

    const trimmedLabel = catalogImportNewListLabel.trim() || catalogImportSnapshot?.listLabel.trim() || ''
    if (!trimmedLabel) {
      throw new Error(t('popup.catalogImportNameRequired'))
    }

    const matchedList = findExistingListByLabel(availableLists, trimmedLabel, t)
    if (matchedList) {
      if (!catalogImportMergeConfirmed) {
        throw new Error(
          t('popup.catalogImportDuplicateWarning', {
            label: getLocalizedListDefinitionLabel(matchedList, t),
          }),
        )
      }

      return {
        listId: matchedList.id,
        label: getLocalizedListDefinitionLabel(matchedList, t),
      }
    }

    const created = await addList(trimmedLabel)
    setSnapshot(created.snapshot)
    setListOptions((current) => buildPopupListOptions(created.snapshot.lists, current))
    setCatalogImportTarget(created.list.id)
    setCatalogImportNewListLabel(trimmedLabel)

    return {
      listId: created.list.id,
      label: getLocalizedListDefinitionLabel(created.list, t),
    }
  }

  async function importCatalogSnapshot(snapshotToRecover: CatalogImportSnapshot): Promise<void> {
    if (snapshotToRecover.items.length === 0) {
      console.warn('[WatchLog][CatalogImport] Empty snapshot, nothing to recover', snapshotToRecover)
      return
    }

    const total = snapshotToRecover.items.length
    const listMediaType = inferCatalogListMediaType(snapshotToRecover.items)
    console.info('[WatchLog][CatalogImport] Import start', {
      sourceSite: snapshotToRecover.sourceSite,
      listLabel: snapshotToRecover.listLabel,
      total,
      inferredMediaType: listMediaType,
    })
    setCatalogImportBusy(true)
    setCatalogImportCompletedTarget(null)
    setCatalogImportProgress({
      stage: 'queueing',
      processed: 0,
      total,
    })

    try {
      const destination = await resolveCatalogImportList()
      console.info('[WatchLog][CatalogImport] Destination resolved', destination)
      let latestSnapshot = snapshot
      const importSummary = {
        created: 0,
        moved: 0,
        reused: 0,
        omitted: 0,
      }

      for (let index = 0; index < snapshotToRecover.items.length; index += 1) {
        const item = snapshotToRecover.items[index]
        console.debug('[WatchLog][CatalogImport] Inspecting item', {
          index: index + 1,
          total,
          title: item.title,
          normalizedTitle: item.normalizedTitle,
          sourceUrl: item.sourceUrl,
          mediaType: item.mediaType,
        })
        const detection = buildCatalogImportDetection(
          item,
          snapshotToRecover.sourceSite,
          listMediaType,
        )
        const existingWithSameType = toLibraryEntries(latestSnapshot).find((entry) => {
          return (
            entry.catalog.mediaType === detection.mediaType &&
            entry.catalog.normalizedTitle === detection.normalizedTitle
          )
        })

        if (existingWithSameType?.activity.status === destination.listId) {
          importSummary.omitted += 1
          console.debug('[WatchLog][CatalogImport] Omitted already saved item', {
            title: item.title,
            destination: destination.listId,
          })
          setCatalogImportProgress({
            stage: 'queueing',
            processed: index + 1,
            total,
            label: destination.label,
          })
          continue
        }

        setCatalogImportProgress({
          stage: 'queueing',
          processed: index,
          total,
          label: destination.label,
        })

        const previousCatalogCount = latestSnapshot.catalog.length
        const previousActivity = latestSnapshot.activity.find(
          (activity) => activity.catalogId === existingWithSameType?.catalog.id,
        )
        const response = await saveDetection({
          detection,
          listId: destination.listId,
          metadataSyncStatus: 'pending',
          skipMetadataLookup: true,
          disableTemporaryPoster: true,
        })
        console.debug('[WatchLog][CatalogImport] Saved item', {
          title: item.title,
          before: previousCatalogCount,
          after: response.snapshot.catalog.length,
        })

        if (response.snapshot.catalog.length > previousCatalogCount) {
          importSummary.created += 1
        } else if (previousActivity && previousActivity.status !== destination.listId) {
          importSummary.moved += 1
        } else {
          importSummary.reused += 1
        }

        latestSnapshot = response.snapshot

        setCatalogImportProgress({
          stage: 'queueing',
          processed: index + 1,
          total,
          label: destination.label,
        })
      }

      setSnapshot(latestSnapshot)
      setListOptions((current) => buildPopupListOptions(latestSnapshot.lists, current))
      setSelectedList(destination.listId)
      setCatalogImportCompletedTarget(destination)

      setCatalogImportProgress({
        stage: 'done',
        processed: total,
        total,
        label: destination.label,
        summary: importSummary,
      })
      console.info('[WatchLog][CatalogImport] Import done', {
        destination,
        summary: importSummary,
      })
    } catch (error) {
      console.error('[WatchLog][CatalogImport] Import failed', error)
      setCatalogImportProgress({
        stage: 'error',
        processed: 0,
        total,
        reason: error instanceof Error ? error.message : 'catalog-import-failed',
      })
    } finally {
      setCatalogImportBusy(false)
    }
  }

  async function handleRecoverCatalog(): Promise<void> {
    if (!catalogImportSnapshot) {
      return
    }

    await importCatalogSnapshot(catalogImportSnapshot)
  }

  async function handleScanAndRecoverOlympusCatalog(): Promise<void> {
    if (targetTabId === null) {
      console.warn('[WatchLog][Olympus] Scan requested without active tab id')
      return
    }

    console.info('[WatchLog][Olympus] Scan start', {
      tabId: targetTabId,
      tabUrl: targetTabUrl,
    })
    setCatalogImportScanBusy(true)
    setCatalogImportBusy(true)
    setCatalogImportProgress({
      stage: 'queueing',
      processed: 0,
      total: 0,
      label: t('popup.catalogImportTitle'),
    })

    try {
      const snapshotFromPage = await runOlympusBibliotecaCatalogProbe(targetTabId)
      console.info('[WatchLog][Olympus] Scan probe result', {
        found: snapshotFromPage?.items.length ?? 0,
        listLabel: snapshotFromPage?.listLabel ?? null,
        sourceUrl: snapshotFromPage?.sourceUrl ?? null,
      })
      if (!snapshotFromPage || snapshotFromPage.items.length === 0) {
        console.warn('[WatchLog][Olympus] No recoverable items found')
        throw new Error('No se encontró contenido recuperable en Olympus Biblioteca.')
      }

      setCatalogImportSnapshot(snapshotFromPage)
      await importCatalogSnapshot(snapshotFromPage)
    } catch (error) {
      console.error('[WatchLog][Olympus] Scan failed', error)
      setCatalogImportProgress({
        stage: 'error',
        processed: 0,
        total: 0,
        reason: error instanceof Error ? error.message : 'olympus-catalog-scan-failed',
      })
    } finally {
      setCatalogImportBusy(false)
      setCatalogImportScanBusy(false)
    }
  }

  async function openLibrary(target?: {
    viewId?: string
    catalogId?: string
    query?: string
  }): Promise<void> {
    await chrome.tabs.create({
      url: buildLibraryUrl(chrome.runtime.getURL('library.html'), target),
    })
    window.close()
  }

  async function handleOpenMatchedEntry(): Promise<void> {
    if (!matchedLibraryEntry) {
      return
    }

    await openLibrary({
      viewId: matchedLibraryEntry.activity.status,
      catalogId: matchedLibraryEntry.catalog.id,
      query: matchedLibraryEntry.catalog.title,
    })
  }

  function handleSelectSuggestedTitle(title: string): void {
    if (!detection || !title.trim()) {
      return
    }

    const nextTitle = title.trim()
    setDetection((current) => {
      if (!current) {
        return current
      }

      if (current.title === nextTitle && current.normalizedTitle === normalizeTitle(nextTitle)) {
        return current
      }

      return {
        ...current,
        title: nextTitle,
        normalizedTitle: normalizeTitle(nextTitle),
      }
    })
    setResolvedMetadata(null)
  }

  async function handleCatalogImportAction(): Promise<void> {
    if (catalogImportCompletedTarget && catalogImportProgress?.stage === 'done') {
      await openLibrary({
        viewId: catalogImportCompletedTarget.listId,
      })
      return
    }

    await handleRecoverCatalog()
  }

  const availableLists = getSortedLocalizedLists(
    buildPopupListOptions(snapshot.lists, listOptions),
    locale,
    t,
  )
  const catalogImportDuplicateList =
    catalogImportSnapshot && catalogImportTarget === CREATE_NEW_LIST_OPTION
      ? findExistingListByLabel(
          availableLists,
          catalogImportNewListLabel.trim() || catalogImportSnapshot.listLabel,
          t,
        ) ?? null
      : null
  const catalogImportCount =
    catalogImportSnapshot?.reportedCount ?? catalogImportSnapshot?.visibleCount ?? 0
  const catalogImportPreviewItems = catalogImportSnapshot?.items.slice(0, 4) ?? []
  const catalogImportNeedsNewListName = catalogImportTarget === CREATE_NEW_LIST_OPTION
  const catalogImportCanRun =
    !catalogImportBusy &&
    (!catalogImportNeedsNewListName || Boolean(catalogImportNewListLabel.trim())) &&
    (!catalogImportDuplicateList || catalogImportMergeConfirmed)
  const isOlympusCatalogPage =
    targetTabUrl !== null && isOlympusBibliotecaCatalogPage(targetTabUrl)
  const catalogImportButtonLabel =
    catalogImportCompletedTarget && catalogImportProgress?.stage === 'done'
      ? t('popup.catalogImportOpenRecovered')
      : t('popup.catalogImportAction')
  const catalogImportStatusMessage = (() => {
    if (!catalogImportSnapshot) {
      return null
    }

    if (catalogImportProgress?.stage === 'queueing') {
      return t('popup.catalogImportQueueing', {
        current: catalogImportProgress.processed,
        total: catalogImportProgress.total,
      })
    }

    if (catalogImportProgress?.stage === 'done') {
      return t('popup.catalogImportDone', {
        count: catalogImportProgress.total,
        label: catalogImportProgress.label ?? catalogImportSnapshot.listLabel,
      })
    }

    if (catalogImportProgress?.stage === 'error') {
      return t('popup.catalogImportFailed', {
        reason: catalogImportProgress.reason ?? 'catalog-import-failed',
      })
    }

    return t('popup.catalogImportSummary', {
      count: catalogImportCount,
      label: catalogImportSnapshot.listLabel,
    })
  })()
  const catalogImportHintMessage = catalogImportSnapshot
    ? catalogImportProgress?.stage === 'done' && catalogImportProgress.summary
      ? t('popup.catalogImportDoneBreakdown', {
          created: catalogImportProgress.summary.created,
          moved: catalogImportProgress.summary.moved,
          reused: catalogImportProgress.summary.reused,
          omitted: catalogImportProgress.summary.omitted,
        })
      : catalogImportDuplicateList
        ? t('popup.catalogImportDuplicateWarning', {
            label: getLocalizedListDefinitionLabel(catalogImportDuplicateList, t),
          })
        : t('popup.catalogImportNameSuggestion')
    : null
  const recentEntries = toLibraryEntries(snapshot).slice(0, 3)
  const sourceHost = detection ? getHostnameLabel(detection.url) : ''
  const currentListLabel = getLocalizedListLabel(availableLists, selectedList, t)
  const captureProgressPercent = detection ? getDetectionProgressPercent(detection) : 0
  const detectionProgressLabel = detection
    ? getLocalizedProgressLabel(
        {
          season: detection.season,
          episode: detection.episode,
          episodeTotal: detection.episodeTotal,
          chapter: detection.chapter,
          chapterTotal: detection.chapterTotal,
          progressText: detection.progressLabel,
        },
        t,
      )
    : ''
  const activeSessionsLabel = t(
    recentEntries.length === 1 ? 'popup.activeSession.one' : 'popup.activeSession.other',
    { count: recentEntries.length },
  )
  // const captureInitials = detection ? getTitleInitials(detection.title) : 'WL'
  const captureInitials = detection ? (detection.title) : 'WL'
  const hasOfficialPoster = Boolean(resolvedMetadata?.poster) || hasStoredOfficialPoster(matchedLibraryEntry)
  const shouldShowUnofficialPosterUI = !hasOfficialPoster && posterCandidates.length > 0
  const selectedPosterCandidate =
    posterCandidates.find((candidate) => candidate.url === selectedPosterUrl) ?? posterCandidates[0] ?? null
  const selectedUnofficialPoster = shouldShowUnofficialPosterUI
    ? selectedPosterCandidate?.url ?? null
    : null
  const fallbackCapturePoster = detection
    ? getPreferredCapturePoster(
        matchedLibraryEntry,
        resolvedMetadata,
        selectedUnofficialPoster,
        capturePoster,
      )
    : '/mock-posters/poster-01.svg'
  const popupOtherTitles = detection
    ? getPopupOtherTitles(
        detection.title,
        matchedLibraryEntry?.catalog.aliases,
        resolvedMetadata?.aliases,
      )
    : []
  const message = t(messageState.key, messageState.params)

  return (
    <div className="app-shell popup-shell">
      <div className="panel popup-card">
        <header className="popup-topbar">
          <div className="brand-lockup popup-brand">
            {/* <img className="brand-icon" src="/icons/favicon-32x32.png" alt="WatchLog logo" /> */}
            <img className="brand-icon" src="/icons/android-chrome-192x192.png" alt="WatchLog logo" />
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
              onClick={() => void openLibrary()}
            >
              <OpenInNewIcon />
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
                      alt={`${detection.title} poster`}
                    />
                    <span className="capture-art-overlay" />
                    {selectedUnofficialPoster ? (
                      <span className="capture-poster-badge">{t('popup.posterUnofficial')}</span>
                    ) : null}
                    <span className="capture-site">{detection.sourceSite}</span>
                    <strong className="capture-initials">{captureInitials}</strong>
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
                    <p className="label popup-compact-label">{t('popup.titleLabel')}</p>
                    <div className="popup-title-panel">
                      <div className="popup-title-header">
                        <strong className="popup-title-value" title={detection.title}>
                          {detection.title}
                        </strong>
                        {matchedLibraryEntry ? (
                          <button
                            className="popup-title-jump"
                            type="button"
                            aria-label={t('popup.openMatchedInLibrary')}
                            title={t('popup.openMatchedInLibrary')}
                            onClick={() => void handleOpenMatchedEntry()}
                          >
                            <JumpToLibraryIcon />
                          </button>
                        ) : null}
                      </div>
                      {popupOtherTitles.length > 0 ? (
                        <div className="popup-title-alias-block">
                          <p className="popup-title-alias-label">{t('popup.otherTitles')}</p>
                          <div className="popup-title-alias-list">
                            {popupOtherTitles.map((title) => (
                              <span key={title} className="popup-title-alias-chip" title={title}>
                                {title}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {titleSuggestions.length > 1 ? (
                        <div className="popup-title-suggestion-block">
                          <p className="popup-title-alias-label">Sugerencias de título</p>
                          <div className="popup-title-suggestion-list">
                            {titleSuggestions.map((title) => {
                              const isActive = normalizeTitle(title) === normalizeTitle(detection.title)

                              return (
                                <button
                                  key={title}
                                  className={`popup-title-suggestion-chip ${isActive ? 'is-active' : ''}`}
                                  type="button"
                                  onClick={() => handleSelectSuggestedTitle(title)}
                                  title={title}
                                >
                                  <span className="popup-title-suggestion-text">{title}</span>
                                  {isActive ? (
                                    <span className="popup-title-suggestion-current">Actual</span>
                                  ) : null}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {shouldShowUnofficialPosterUI ? (
                    <div className="popup-section">
                      <div className="popup-unofficial-copy">
                        <span className="popup-unofficial-pill">{t('popup.posterUnofficial')}</span>
                        <p className="popup-unofficial-message">
                          {t('popup.posterMetadataMissing')}
                        </p>
                      </div>
                      <div className="popup-poster-picker">
                        {posterCandidates.map((candidate) => (
                          <button
                            key={candidate.url}
                            className={`popup-poster-option ${
                              selectedPosterCandidate?.url === candidate.url ? 'is-selected' : ''
                            }`}
                            type="button"
                            onClick={() => setSelectedPosterUrl(candidate.url)}
                          >
                            <img
                              className="popup-poster-option-image"
                              src={candidate.url}
                              alt={candidate.label}
                            />
                            <span className="popup-poster-option-label">{candidate.label}</span>
                          </button>
                        ))}
                      </div>
                      <p className="popup-poster-hint">{t('popup.posterPickerHint')}</p>
                    </div>
                  ) : null}

                  <div className="capture-progress-block">
                    <div className="capture-progress-copy">
                      <span>
                        {captureProgressPercent > 0
                          ? t('popup.completePercent', { percent: captureProgressPercent })
                          : t('popup.awaitingProgress')}
                      </span>
                      <span>{detectionProgressLabel}</span>
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
                    <span className="status-pill status-pill-progress">{detectionProgressLabel}</span>
                  </div>

                  <div className="popup-grid capture-controls">
                    <div className="control-panel">
                      <label className="label popup-compact-label">
                        {t('popup.listLabel')}
                      </label>
                      <CustomSelect
                        value={selectedList}
                        onChange={setSelectedList}
                        options={availableLists.map((list) => ({
                          value: list.id,
                          label: getLocalizedListDefinitionLabel(list, t),
                        }))}
                      />
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
                <button
                  className={`button popup-save-button ${saveState === 'saved' ? 'is-saved' : ''}`}
                  type="button"
                  disabled={busy}
                  onClick={handleSave}
                >
                  {saveState === 'saved' ? (
                    <span className="popup-save-button-content" aria-live="polite">
                      <CheckIcon />
                      <span>{saveButtonLabel}</span>
                    </span>
                  ) : (
                    saveButtonLabel
                  )}
                </button>
                <button className="button secondary" type="button" onClick={() => void openLibrary()}>
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
              <button className="button" type="button" disabled={analyzing} onClick={handleRetryAnalysis}>
                {t('popup.reanalyzeTab')}
              </button>
              <button className="button secondary" type="button" onClick={() => void openLibrary()}>
                {t('popup.openFullLibrary')}
              </button>
            </div>
          </section>
        )}

        {catalogImportSnapshot || isOlympusCatalogPage ? (
          <section className="popup-hero popup-import-section">
            <div className="popup-heading-row">
              <div>
                <p className="eyebrow">{t('popup.catalogImportKicker')}</p>
                <h2 className="section-title popup-import-title">{t('popup.catalogImportTitle')}</h2>
              </div>
              <span className="section-chip">
                {catalogImportSnapshot ? catalogImportCount : t('popup.noSignal')}
              </span>
            </div>

            <div className="catalog-import-card">
              {!catalogImportSnapshot && isOlympusCatalogPage ? (
                <div className="catalog-import-scan-callout">
                  <strong className="catalog-import-list-label">Olympus Biblioteca</strong>
                  <p className="tiny catalog-import-hint">{t('popup.catalogImportScanHint')}</p>
                  <div className="popup-footer popup-primary-actions">
                    <button
                      className="button"
                      type="button"
                      disabled={catalogImportScanBusy}
                      onClick={() => void handleScanAndRecoverOlympusCatalog()}
                    >
                      {catalogImportScanBusy
                        ? t('popup.reanalyzing')
                        : t('popup.catalogImportScanAction')}
                    </button>
                  </div>
                </div>
              ) : null}

              {catalogImportSnapshot ? (
                <>
                  <div className="catalog-import-copy">
                    <strong className="catalog-import-list-label">{catalogImportSnapshot.listLabel}</strong>
                    <p className="muted popup-message">{catalogImportStatusMessage}</p>
                    <p className="tiny catalog-import-hint">{catalogImportHintMessage}</p>
                  </div>

                  <div className="popup-section">
                    <label className="label popup-compact-label">
                      {t('popup.catalogImportTargetLabel')}
                    </label>
                    <CustomSelect
                      value={catalogImportTarget}
                      disabled={catalogImportBusy}
                      onChange={setCatalogImportTarget}
                      options={[
                        {
                          value: CREATE_NEW_LIST_OPTION,
                          label: t('popup.catalogImportCreateOption'),
                        },
                        ...availableLists.map((list) => ({
                          value: list.id,
                          label: getLocalizedListDefinitionLabel(list, t),
                        })),
                      ]}
                    />
                  </div>

                  {catalogImportNeedsNewListName ? (
                    <div className="popup-section">
                      <label className="label popup-compact-label" htmlFor="catalog-import-new-list">
                        {t('popup.catalogImportNewListLabel')}
                      </label>
                      <input
                        id="catalog-import-new-list"
                        className="field"
                        value={catalogImportNewListLabel}
                        disabled={catalogImportBusy}
                        placeholder={t('popup.catalogImportNewListPlaceholder')}
                        onChange={(event) => setCatalogImportNewListLabel(event.target.value)}
                      />
                    </div>
                  ) : null}

                  {catalogImportDuplicateList ? (
                    <label className="catalog-import-confirm">
                      <input
                        type="checkbox"
                        checked={catalogImportMergeConfirmed}
                        disabled={catalogImportBusy}
                        onChange={(event) => setCatalogImportMergeConfirmed(event.target.checked)}
                      />
                      <span>{t('popup.catalogImportConfirmMerge')}</span>
                    </label>
                  ) : null}

                  {catalogImportPreviewItems.length > 0 ? (
                    <div className="catalog-import-preview">
                      {catalogImportPreviewItems.map((item) => (
                        <span key={`${item.sourceId}:${item.title}`} className="popup-title-alias-chip">
                          {item.title}
                        </span>
                      ))}
                      {catalogImportSnapshot.items.length > catalogImportPreviewItems.length ? (
                        <span className="popup-title-alias-chip">
                          {t('popup.catalogImportMore', {
                            count: catalogImportSnapshot.items.length - catalogImportPreviewItems.length,
                          })}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                <button
                  className="button catalog-import-button"
                  type="button"
                  disabled={
                    !catalogImportCanRun &&
                    !(catalogImportCompletedTarget && catalogImportProgress?.stage === 'done')
                  }
                  onClick={() => void handleCatalogImportAction()}
                >
                  {catalogImportButtonLabel}
                </button>
                </>
              ) : null}
            </div>
          </section>
        ) : null}

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
            recentEntries.map((entry) => {
              const syncState = getCatalogSyncState(entry.catalog)
              const showPendingPlaceholder = syncState === 'pending' && !entry.catalog.poster

              return (
                <article className="recent-card" key={entry.catalog.id}>
                  <div className="recent-art">
                    {showPendingPlaceholder ? (
                      <div className="recent-art-image recent-art-placeholder" aria-hidden="true" />
                    ) : (
                      <img
                        className="recent-art-image"
                        src={entry.catalog.poster ?? getTemporaryPoster(entry.catalog.normalizedTitle)}
                        alt={`${entry.catalog.title} poster`}
                      />
                    )}
                    {!entry.catalog.poster && !showPendingPlaceholder ? (
                      <span className="recent-art-fallback">
                        {getTitleInitials(entry.catalog.title)}
                      </span>
                    ) : null}
                    <span className="recent-art-overlay" />
                    {syncState ? (
                      <span className={`catalog-sync-badge recent-sync-badge is-${syncState}`}>
                        <SyncStatusGlyph
                          className="catalog-sync-icon"
                          synced={syncState === 'synced'}
                        />
                      </span>
                    ) : null}
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
                        {getPopupEntryProgressText(entry, t)} /{' '}
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
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
