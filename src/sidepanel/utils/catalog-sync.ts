/** Contains metadata sync helpers for building detections and reading sync badges from catalog data. */
import { isCatalogMetadataPending, isCatalogMetadataSynced } from '../../shared/catalog-sync'
import { getResolvedProgressState } from '../../shared/progress'
import type { DetectionResult, LibraryEntry } from '../../shared/types'

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

export function buildDetectionForCatalogSync(entry: LibraryEntry): DetectionResult {
  const progress = getResolvedProgressState(entry.activity.currentProgress, entry.activity.status, {
    episodeCount: entry.catalog.episodeCount,
    chapterCount: entry.catalog.chapterCount,
  })

  return {
    title: entry.catalog.title,
    normalizedTitle: entry.catalog.normalizedTitle,
    mediaType: entry.catalog.mediaType,
    sourceSite: entry.activity.lastSource?.siteName ?? 'Library',
    url: entry.activity.lastSource?.url ?? '',
    favicon: entry.activity.lastSource?.favicon ?? '',
    pageTitle: entry.activity.lastSource?.pageTitle ?? entry.catalog.title,
    season: progress.season,
    episode: progress.episode,
    episodeTotal: progress.episodeTotal,
    chapter: progress.chapter,
    chapterTotal: progress.chapterTotal,
    progressLabel: progress.progressText,
    confidence: 1,
  }
}
