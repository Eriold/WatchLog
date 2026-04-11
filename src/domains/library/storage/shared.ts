import {
  areMediaTypesCompatible,
  getMetadataExternalIds,
  getMetadataNormalizedTitles,
  mergeAlternativeTitles,
} from '../../../shared/metadata/matching'
import { getRandomTemporaryPoster, hasTemporaryPoster } from '../../../shared/mock-posters'
import { getResolvedProgressState } from '../../../shared/progress'
import {
  areSeasonNumbersCompatible,
  getCatalogSeasonNumber,
  getDetectionSeasonNumber,
  getMetadataSeasonNumber,
} from '../../../shared/season'
import type {
  CatalogEntry,
  DetectionResult,
  MetadataCard,
  PosterKind,
  ProgressState,
  SourceHistoryEntry,
  WatchLogSnapshot,
} from '../../../shared/types'
import { slugify } from '../../../shared/utils/normalize'
import { nowIso } from '../../../shared/utils/time'

export function createUniqueId(prefix: string): string {
  const randomSuffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  return `${prefix}-${randomSuffix}`
}

export function createSourceEntry(detection: DetectionResult): SourceHistoryEntry {
  const detectedAt = nowIso()

  return {
    id: createUniqueId(slugify(detection.sourceSite)),
    siteName: detection.sourceSite,
    url: detection.url,
    favicon: detection.favicon,
    pageTitle: detection.pageTitle,
    detectedAt,
    progressText: detection.progressLabel,
    season: detection.season,
    episode: detection.episode,
    episodeTotal: detection.episodeTotal,
    chapter: detection.chapter,
    chapterTotal: detection.chapterTotal,
  }
}

export function buildExternalIds(
  existingExternalIds: Record<string, string>,
  metadata?: MetadataCard,
): Record<string, string> {
  return {
    ...existingExternalIds,
    ...getMetadataExternalIds(metadata),
  }
}

export function getCatalogPrimaryTitle(detection: DetectionResult, metadata?: MetadataCard): string {
  return metadata?.title ?? detection.title
}

export function getCatalogPrimaryNormalizedTitle(
  detection: DetectionResult,
  metadata?: MetadataCard,
): string {
  return metadata?.normalizedTitle ?? detection.normalizedTitle
}

export function buildCatalogAliases(
  primaryTitle: string,
  existingCatalog?: CatalogEntry,
  detection?: DetectionResult,
  metadata?: MetadataCard,
): string[] {
  return mergeAlternativeTitles(primaryTitle, [
    existingCatalog?.title,
    ...(existingCatalog?.aliases ?? []),
    detection?.title,
    ...(metadata?.aliases ?? []),
  ])
}

export function findCatalogMatch(
  snapshot: WatchLogSnapshot,
  detection: DetectionResult,
  metadata?: MetadataCard,
): CatalogEntry | undefined {
  const metadataExternalIds = getMetadataExternalIds(metadata)
  const targetTitles = metadata
    ? getMetadataNormalizedTitles(metadata)
    : [detection.normalizedTitle]
  const targetMediaType = metadata?.mediaType ?? detection.mediaType
  const targetSeasonNumber =
    (metadata ? getMetadataSeasonNumber(metadata) : undefined) ??
    getDetectionSeasonNumber(detection)
  const getSnapshotCatalogSeasonNumber = (item: CatalogEntry): number | undefined => {
    const activity = snapshot.activity.find((entry) => entry.catalogId === item.id)

    return (
      getCatalogSeasonNumber(item) ??
      activity?.currentProgress.season ??
      activity?.lastSource?.season
    )
  }

  if (metadata?.id) {
    const directIdMatch = snapshot.catalog.find((item) => item.id === metadata.id)
    if (directIdMatch) {
      return directIdMatch
    }
  }

  if (metadataExternalIds.anilist) {
    const externalIdMatch = snapshot.catalog.find(
      (item) => item.externalIds.anilist === metadataExternalIds.anilist,
    )
    if (externalIdMatch) {
      return externalIdMatch
    }
  }

  const compatibleTitleMatch = snapshot.catalog.find((item) => {
    return (
      areMediaTypesCompatible(item.mediaType, targetMediaType) &&
      areSeasonNumbersCompatible(getSnapshotCatalogSeasonNumber(item), targetSeasonNumber) &&
      targetTitles.includes(item.normalizedTitle)
    )
  })

  if (compatibleTitleMatch) {
    return compatibleTitleMatch
  }

  const detectionTitleMatch = snapshot.catalog.find((item) => {
    return (
      areMediaTypesCompatible(item.mediaType, detection.mediaType) &&
      areSeasonNumbersCompatible(getSnapshotCatalogSeasonNumber(item), targetSeasonNumber) &&
      item.normalizedTitle === detection.normalizedTitle
    )
  })

  if (detectionTitleMatch) {
    return detectionTitleMatch
  }

  return snapshot.catalog.find((item) => {
    const mediaTypesAreCompatible =
      targetMediaType === 'unknown' ||
      item.mediaType === 'unknown' ||
      areMediaTypesCompatible(item.mediaType, targetMediaType)

    return (
      mediaTypesAreCompatible &&
      areSeasonNumbersCompatible(getSnapshotCatalogSeasonNumber(item), targetSeasonNumber) &&
      targetTitles.includes(item.normalizedTitle)
    )
  })
}

export function createProgressState(detection: DetectionResult): ProgressState {
  return {
    season: detection.season,
    episode: detection.episode,
    episodeTotal: detection.episodeTotal,
    chapter: detection.chapter,
    chapterTotal: detection.chapterTotal,
    progressText: detection.progressLabel,
  }
}

export function normalizeEntryProgress(
  progress: ProgressState,
  status: string,
  catalog: Pick<CatalogEntry, 'episodeCount' | 'chapterCount'>,
): ProgressState {
  return getResolvedProgressState(progress, status, {
    episodeCount: catalog.episodeCount,
    chapterCount: catalog.chapterCount,
  })
}

export function getCatalogPosterKind(
  catalog?: Pick<CatalogEntry, 'poster' | 'posterKind'> | null,
): PosterKind | undefined {
  if (!catalog?.poster) {
    return undefined
  }

  if (catalog.posterKind) {
    return catalog.posterKind
  }

  return hasTemporaryPoster(catalog.poster) ? 'temporary' : 'official'
}

export function resolveCatalogPoster(input: {
  metadata?: MetadataCard
  existingCatalog?: CatalogEntry
  posterOverride?: string
  disableTemporaryPoster?: boolean
}): { poster?: string; posterKind?: PosterKind } {
  if (input.metadata?.poster) {
    return {
      poster: input.metadata.poster,
      posterKind: 'official',
    }
  }

  const existingPosterKind = getCatalogPosterKind(input.existingCatalog)
  if (input.existingCatalog?.poster && existingPosterKind === 'official') {
    return {
      poster: input.existingCatalog.poster,
      posterKind: 'official',
    }
  }

  if (input.posterOverride) {
    return {
      poster: input.posterOverride,
      posterKind: 'unofficial',
    }
  }

  if (input.existingCatalog?.poster && existingPosterKind) {
    return {
      poster: input.existingCatalog.poster,
      posterKind: existingPosterKind,
    }
  }

  if (input.disableTemporaryPoster) {
    return {}
  }

  return {
    poster: getRandomTemporaryPoster(),
    posterKind: 'temporary',
  }
}

export function dedupeHistory(
  history: SourceHistoryEntry[],
  newSource: SourceHistoryEntry,
): SourceHistoryEntry[] {
  const filtered = history.filter((item) => {
    return !(
      item.siteName === newSource.siteName &&
      item.url === newSource.url &&
      item.progressText === newSource.progressText
    )
  })

  return [newSource, ...filtered].slice(0, 30)
}
