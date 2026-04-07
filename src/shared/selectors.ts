import type {
  DetectionResult,
  LibraryEntry,
  WatchListDefinition,
  WatchLogSnapshot,
} from './types'

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
  const exactMediaMatch = entries.find((entry) => {
    return (
      entry.catalog.normalizedTitle === detection.normalizedTitle &&
      entry.catalog.mediaType === detection.mediaType
    )
  })

  if (exactMediaMatch) {
    return exactMediaMatch
  }

  const exactTitleMatch = entries.find((entry) => {
    return entry.catalog.normalizedTitle === detection.normalizedTitle
  })

  if (exactTitleMatch) {
    return exactTitleMatch
  }

  const fuzzyMediaMatch = entries.find((entry) => {
    return (
      entry.catalog.mediaType === detection.mediaType &&
      (entry.catalog.normalizedTitle.includes(detection.normalizedTitle) ||
        detection.normalizedTitle.includes(entry.catalog.normalizedTitle))
    )
  })

  if (fuzzyMediaMatch) {
    return fuzzyMediaMatch
  }

  return (
    entries.find((entry) => {
      return (
        entry.catalog.normalizedTitle.includes(detection.normalizedTitle) ||
        detection.normalizedTitle.includes(entry.catalog.normalizedTitle)
      )
    }) ?? null
  )
}
