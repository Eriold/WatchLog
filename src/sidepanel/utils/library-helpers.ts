/** Contains shared sidepanel helpers for counts, labels, badges, sources, and score formatting. */
import type { I18nValue } from '../../shared/i18n/context'
import { getCardSeasonCountBadge, getLibraryEntrySeasonNumber, getMetadataSeasonNumber } from '../../shared/season'
import type { LibraryEntry, MetadataCard, WatchLogSnapshot } from '../../shared/types'

export function getListEntryCount(listId: string, entries: LibraryEntry[]): number {
  return entries.filter((entry) => entry.activity.status === listId).length
}

export function getDefaultExplorerSaveListId(snapshot: WatchLogSnapshot): string {
  return snapshot.lists.find((list) => list.id === 'library')?.id ?? snapshot.lists[0]?.id ?? 'library'
}

export function getExplorerSourceLabel(item: MetadataCard, t: I18nValue['t']): string {
  if (item.id.startsWith('anilist:')) return 'AniList'
  if (item.id.startsWith('mangadex:')) return 'MangaDex'
  return t('library.mockCatalog')
}

export function getMediaTypeBadgeClass(mediaType: LibraryEntry['catalog']['mediaType']): string {
  return `type-${mediaType}`
}

export function formatCommunityScore(score?: number): string | null {
  if (score === undefined || Number.isNaN(score)) {
    return null
  }

  return score % 1 === 0 ? String(score) : score.toFixed(1)
}

export function getExplorerCardSeasonBadge(item: MetadataCard): string | null {
  return getCardSeasonCountBadge(
    getMetadataSeasonNumber(item),
    item.episodeCount,
    item.chapterCount,
  )
}

export function getLibraryCardSeasonBadge(entry: LibraryEntry): string | null {
  return getCardSeasonCountBadge(
    getLibraryEntrySeasonNumber(entry),
    entry.catalog.episodeCount ?? entry.activity.currentProgress.episodeTotal,
    entry.catalog.chapterCount ?? entry.activity.currentProgress.chapterTotal,
  )
}
