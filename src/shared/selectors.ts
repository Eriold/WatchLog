import type {
  MetadataCard,
  DetectionResult,
  LibraryEntry,
  WatchListDefinition,
  WatchLogSnapshot,
} from './types'
import {
  areMediaTypesCompatible,
  getMetadataExternalIds,
  getMetadataNormalizedTitles,
} from './metadata/matching'
import {
  areSeasonNumbersCompatible,
  getDetectionSeasonNumber,
  getLibraryEntrySeasonNumber,
  getMetadataSeasonNumber,
} from './season'

function getCanonicalSourceUrlKey(rawUrl?: string): string | null {
  if (!rawUrl) {
    return null
  }

  try {
    const url = new URL(rawUrl)
    const segments = url.pathname.split('/').filter(Boolean)

    if (segments.length === 0) {
      return `${url.hostname.replace(/^www\./i, '')}|`
    }

    const canonicalSegments =
      segments.length > 1 && /^\d+$/.test(segments[segments.length - 1] ?? '')
        ? segments.slice(0, -1)
        : segments

    return `${url.hostname.replace(/^www\./i, '')}|${canonicalSegments.join('/')}`
  } catch {
    return null
  }
}

function getEntrySourceUrlKeys(entry: LibraryEntry): string[] {
  const keys = new Set<string>()

  const lastSourceKey = getCanonicalSourceUrlKey(entry.activity.lastSource?.url)
  if (lastSourceKey) {
    keys.add(lastSourceKey)
  }

  for (const source of entry.activity.sourceHistory) {
    const key = getCanonicalSourceUrlKey(source.url)
    if (key) {
      keys.add(key)
    }
  }

  return Array.from(keys)
}

export function toLibraryEntries(snapshot: WatchLogSnapshot): LibraryEntry[] {
  return snapshot.activity
    .map((activity) => {
      const catalog = snapshot.catalog.find((item) => item.id === activity.catalogId)
      if (!catalog) {
        return null
      }

      return { catalog, activity }
    })
    .filter((entry): entry is LibraryEntry => Boolean(entry))
    .sort((a, b) => {
      return (
        new Date(b.activity.updatedAt).getTime() - new Date(a.activity.updatedAt).getTime()
      )
    })
}

export function getListLabel(lists: WatchListDefinition[], listId: string): string {
  return lists.find((list) => list.id === listId)?.label ?? listId
}

export function findMatchingLibraryEntry(
  snapshot: WatchLogSnapshot,
  detection: DetectionResult,
): LibraryEntry | null {
  const entries = toLibraryEntries(snapshot)
  const detectionSeasonNumber = getDetectionSeasonNumber(detection)
  const exactPrimaryMatch = entries.find((entry) => {
    return (
      areMediaTypesCompatible(entry.catalog.mediaType, detection.mediaType) &&
      areSeasonNumbersCompatible(getLibraryEntrySeasonNumber(entry), detectionSeasonNumber) &&
      entry.catalog.normalizedTitle === detection.normalizedTitle
    )
  })

  if (exactPrimaryMatch) {
    return exactPrimaryMatch
  }

  const detectionSourceKey = getCanonicalSourceUrlKey(detection.url)
  if (detectionSourceKey) {
    const canonicalSourceMatch = entries.find((entry) => {
      return getEntrySourceUrlKeys(entry).includes(detectionSourceKey)
    })

    if (
      canonicalSourceMatch &&
      areMediaTypesCompatible(canonicalSourceMatch.catalog.mediaType, detection.mediaType) &&
      areSeasonNumbersCompatible(getLibraryEntrySeasonNumber(canonicalSourceMatch), detectionSeasonNumber)
    ) {
      return canonicalSourceMatch
    }
  }

  return (
    entries.find((entry) => {
      return (
        areSeasonNumbersCompatible(getLibraryEntrySeasonNumber(entry), detectionSeasonNumber) &&
        entry.catalog.normalizedTitle === detection.normalizedTitle
      )
    }) ?? null
  )
}

export function findMatchingLibraryEntryForMetadata(
  snapshot: WatchLogSnapshot,
  metadata: MetadataCard,
): LibraryEntry | null {
  const entries = toLibraryEntries(snapshot)
  const metadataExternalIds = getMetadataExternalIds(metadata)
  const metadataTitles = getMetadataNormalizedTitles(metadata)
  const metadataSeasonNumber = getMetadataSeasonNumber(metadata)

  if (metadataExternalIds.anilist) {
    const externalIdMatch = entries.find(
      (entry) => entry.catalog.externalIds.anilist === metadataExternalIds.anilist,
    )
    if (externalIdMatch) {
      return externalIdMatch
    }
  }

  return (
    entries.find((entry) => {
      return (
        areMediaTypesCompatible(entry.catalog.mediaType, metadata.mediaType) &&
        areSeasonNumbersCompatible(getLibraryEntrySeasonNumber(entry), metadataSeasonNumber) &&
        metadataTitles.includes(entry.catalog.normalizedTitle)
      )
    }) ?? null
  )
}
