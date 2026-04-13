/** Collects popup-only pure helpers so popup state and rendering can stay small and focused. */
import type { I18nValue } from '../../shared/i18n/context'
import {
  getLocalizedListDefinitionLabel,
  getLocalizedListLabel,
  getLocalizedProgressLabel,
} from '../../shared/i18n/helpers'
import type { DetectionDebugInfo } from '../../shared/messages'
import { hydrateDetectionWithStoredProgress } from '../../shared/metadata/detection-hydration'
import { getResolvedProgressState } from '../../shared/progress'
import {
  findMatchingLibraryEntry,
  findMatchingLibraryEntryForMetadata,
  toLibraryEntries,
} from '../../shared/selectors'
import { storageGet } from '../../shared/storage/browser'
import type {
  DetectionResult,
  LibraryEntry,
  MediaType,
  MetadataCard,
  WatchListDefinition,
  WatchLogSnapshot,
} from '../../shared/types'
import { normalizeTitle } from '../../shared/utils/normalize'
import { getDetectionTitleCandidates } from '../../shared/detection/title-candidates'
import {
  isCatalogMetadataPending,
  isCatalogMetadataSynced,
} from '../../shared/catalog-sync'
import { STORAGE_KEYS, SYSTEM_LISTS } from '../../shared/constants'
import { hasTemporaryPoster } from '../../shared/mock-posters'

export const CREATE_NEW_LIST_OPTION = '__create_new_list__'

export type PopupTranslate = I18nValue['t']

export function getInitialSnapshot(): WatchLogSnapshot {
  return {
    catalog: [],
    activity: [],
    lists: [],
  }
}

export function getEmptyDebug(): DetectionDebugInfo {
  return {
    tabId: null,
    tabUrl: null,
    source: 'none',
  }
}

export function mergePopupLists(lists: WatchListDefinition[]): WatchListDefinition[] {
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

export function buildPopupListOptions(
  snapshotLists: WatchListDefinition[],
  storedLists: WatchListDefinition[],
): WatchListDefinition[] {
  return mergePopupLists([...snapshotLists, ...storedLists])
}

export async function readPopupLists(): Promise<WatchListDefinition[]> {
  const stored = await storageGet<WatchListDefinition[]>(chrome.storage.local, STORAGE_KEYS.lists, [])
  return mergePopupLists(stored)
}

export async function getPopupTargetTab(): Promise<chrome.tabs.Tab | null> {
  let tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  if (tabs.length === 0) {
    tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  }

  return tabs[0] ?? null
}

export function getHostnameLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return url
  }
}

export function getTitleInitials(title: string): string {
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

export function getPopupTitleSuggestions(
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

export function getPopupOtherTitles(
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

export function getCatalogSyncState(
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

export function findExistingListByLabel(
  lists: WatchListDefinition[],
  label: string,
  t: PopupTranslate,
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

export function buildCatalogImportDetection(
  item: {
    title: string
    normalizedTitle: string
    mediaType: MediaType
    sourceUrl: string
  },
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

export function inferCatalogListMediaType(
  items: Array<{ mediaType: MediaType }>,
): MediaType | undefined {
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

export function inferProgressPercent(
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

export function hasEnoughStoredMetadata(entry: LibraryEntry): boolean {
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

export function shouldResolveMetadataForPopup(
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

export function hasStoredOfficialPoster(entry: LibraryEntry | null): boolean {
  const poster = entry?.catalog.poster

  if (!poster || hasTemporaryPoster(poster)) {
    return false
  }

  return entry.catalog.posterKind !== 'unofficial'
}

export function getPreferredCapturePoster(
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

export function getDetectionProgressPercent(detection: DetectionResult): number {
  return inferProgressPercent(
    detection.progressLabel,
    detection.episode,
    detection.episodeTotal,
    detection.chapter,
    detection.chapterTotal,
  )
}

export function getEntryProgressPercent(entry: LibraryEntry): number {
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

export function getPopupEntryProgressText(entry: LibraryEntry, t: PopupTranslate): string {
  const progress = getResolvedProgressState(entry.activity.currentProgress, entry.activity.status, {
    episodeCount: entry.catalog.episodeCount,
    chapterCount: entry.catalog.chapterCount,
  })

  return getLocalizedProgressLabel(progress, t)
}

export function getMatchedLibraryEntry(
  snapshot: WatchLogSnapshot,
  detection: DetectionResult | null,
  resolvedMetadata: MetadataCard | null,
): LibraryEntry | null {
  const matchedFromDetection = detection ? findMatchingLibraryEntry(snapshot, detection) : null
  const matchedFromMetadata = resolvedMetadata
    ? findMatchingLibraryEntryForMetadata(snapshot, resolvedMetadata)
    : null

  return matchedFromMetadata ?? matchedFromDetection
}

export function buildTrackedDetection(
  detection: DetectionResult,
  matchedEntry: LibraryEntry,
): DetectionResult {
  return hydrateDetectionWithStoredProgress(
    {
      ...detection,
      title: matchedEntry.catalog.title,
      normalizedTitle: matchedEntry.catalog.normalizedTitle,
      mediaType: matchedEntry.catalog.mediaType,
    },
    getResolvedProgressState(matchedEntry.activity.currentProgress, matchedEntry.activity.status, {
      episodeCount: matchedEntry.catalog.episodeCount,
      chapterCount: matchedEntry.catalog.chapterCount,
    }),
  )
}

export function getRecentEntries(snapshot: WatchLogSnapshot): LibraryEntry[] {
  return toLibraryEntries(snapshot).slice(0, 3)
}

export function getSelectedListLabel(
  availableLists: WatchListDefinition[],
  selectedList: string,
  t: PopupTranslate,
): string {
  return getLocalizedListLabel(availableLists, selectedList, t)
}
