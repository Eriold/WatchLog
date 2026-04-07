import type {
  MetadataCard,
  DetectionResult,
  LibraryEntry,
  WatchListDefinition,
  WatchLogSnapshot,
} from './types'
import {
  areMediaTypesCompatible,
  getCatalogNormalizedTitles,
  getMetadataExternalIds,
  getMetadataNormalizedTitles,
  hasNormalizedTitleOverlap,
} from './metadata/matching'

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
  const detectionTitles = [detection.normalizedTitle]
  const exactMediaMatch = entries.find((entry) => {
    return (
      areMediaTypesCompatible(entry.catalog.mediaType, detection.mediaType) &&
      hasNormalizedTitleOverlap(getCatalogNormalizedTitles(entry.catalog), detectionTitles)
    )
  })

  if (exactMediaMatch) {
    return exactMediaMatch
  }

  const exactTitleMatch = entries.find((entry) => {
    return hasNormalizedTitleOverlap(getCatalogNormalizedTitles(entry.catalog), detectionTitles)
  })

  if (exactTitleMatch) {
    return exactTitleMatch
  }

  const fuzzyMediaMatch = entries.find((entry) => {
    return (
      areMediaTypesCompatible(entry.catalog.mediaType, detection.mediaType) &&
      hasNormalizedTitleOverlap(getCatalogNormalizedTitles(entry.catalog), detectionTitles)
    )
  })

  if (fuzzyMediaMatch) {
    return fuzzyMediaMatch
  }

  return (
    entries.find((entry) =>
      hasNormalizedTitleOverlap(getCatalogNormalizedTitles(entry.catalog), detectionTitles),
    ) ?? null
  )
}

export function findMatchingLibraryEntryForMetadata(
  snapshot: WatchLogSnapshot,
  metadata: MetadataCard,
): LibraryEntry | null {
  const entries = toLibraryEntries(snapshot)
  const metadataExternalIds = getMetadataExternalIds(metadata)
  const metadataTitles = getMetadataNormalizedTitles(metadata)

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
        hasNormalizedTitleOverlap(getCatalogNormalizedTitles(entry.catalog), metadataTitles)
      )
    }) ?? null
  )
}
