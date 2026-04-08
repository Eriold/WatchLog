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
