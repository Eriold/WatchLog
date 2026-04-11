import {
  buildCatalogAliases,
  buildExternalIds,
  createUniqueId,
  findCatalogMatch,
  getCatalogPrimaryNormalizedTitle,
  getCatalogPrimaryTitle,
  resolveCatalogPoster,
} from './shared'
import {
  getDetectionSeasonNumber,
  getMetadataSeasonNumber,
} from '../../../shared/season'
import type {
  CatalogEntry,
  DetectionResult,
  MetadataCard,
  MetadataSyncStatus,
  WatchLogSnapshot,
} from '../../../shared/types'
import { normalizeTitle, slugify } from '../../../shared/utils/normalize'
import { nowIso } from '../../../shared/utils/time'

export class CatalogRepository {
  findMatch(
    snapshot: WatchLogSnapshot,
    detection: DetectionResult,
    metadata?: MetadataCard,
  ): CatalogEntry | undefined {
    return findCatalogMatch(snapshot, detection, metadata)
  }

  createEntry(
    detection: DetectionResult,
    metadata?: MetadataCard,
    posterOverride?: string,
    metadataSyncStatus?: MetadataSyncStatus,
    disableTemporaryPoster?: boolean,
  ): CatalogEntry {
    const timestamp = nowIso()
    const primaryTitle = getCatalogPrimaryTitle(detection, metadata)
    const poster = resolveCatalogPoster({
      metadata,
      posterOverride,
      disableTemporaryPoster,
    })

    return {
      id: metadata?.id ?? createUniqueId(`catalog-${slugify(detection.title)}`),
      title: primaryTitle,
      normalizedTitle: getCatalogPrimaryNormalizedTitle(detection, metadata),
      aliases: buildCatalogAliases(primaryTitle, undefined, detection, metadata),
      seasonNumber:
        getDetectionSeasonNumber(detection) ??
        (metadata ? getMetadataSeasonNumber(metadata) : undefined),
      mediaType: metadata?.mediaType ?? detection.mediaType,
      metadataSyncStatus: metadata ? 'synced' : metadataSyncStatus,
      score: metadata?.score,
      poster: poster.poster,
      posterKind: poster.posterKind,
      backdrop: metadata?.backdrop,
      genres: metadata?.genres ?? [],
      description: metadata?.description,
      publicationStatus: metadata?.publicationStatus,
      startDate: metadata?.startDate,
      endDate: metadata?.endDate,
      releaseYear: metadata?.releaseYear,
      runtime: metadata?.runtime,
      seasonCount: metadata?.seasonCount,
      episodeCount: metadata?.episodeCount,
      chapterCount: metadata?.chapterCount,
      externalIds: buildExternalIds({}, metadata),
      createdAt: timestamp,
      updatedAt: timestamp,
    }
  }

  mergeDetectedCatalog(params: {
    catalogMatch: CatalogEntry
    detection: DetectionResult
    metadata?: MetadataCard
    posterOverride?: string
    metadataSyncStatus?: MetadataSyncStatus
    disableTemporaryPoster?: boolean
  }): CatalogEntry {
    const {
      catalogMatch,
      detection,
      metadata,
      posterOverride,
      metadataSyncStatus,
      disableTemporaryPoster,
    } = params
    const primaryTitle = getCatalogPrimaryTitle(detection, metadata)

    return {
      ...catalogMatch,
      title: primaryTitle,
      normalizedTitle: getCatalogPrimaryNormalizedTitle(detection, metadata),
      aliases: buildCatalogAliases(primaryTitle, catalogMatch, detection, metadata),
      seasonNumber:
        catalogMatch.seasonNumber ??
        getDetectionSeasonNumber(detection) ??
        (metadata ? getMetadataSeasonNumber(metadata) : undefined),
      mediaType: metadata?.mediaType ?? catalogMatch.mediaType,
      score: metadata?.score ?? catalogMatch.score,
      updatedAt: nowIso(),
      metadataSyncStatus,
      ...resolveCatalogPoster({
        metadata,
        existingCatalog: catalogMatch,
        posterOverride,
        disableTemporaryPoster,
      }),
      backdrop: catalogMatch.backdrop ?? metadata?.backdrop,
      genres: catalogMatch.genres.length > 0 ? catalogMatch.genres : metadata?.genres ?? [],
      description: catalogMatch.description ?? metadata?.description,
      publicationStatus: metadata?.publicationStatus ?? catalogMatch.publicationStatus,
      startDate: metadata?.startDate ?? catalogMatch.startDate,
      endDate: metadata?.endDate ?? catalogMatch.endDate,
      runtime: catalogMatch.runtime ?? metadata?.runtime,
      seasonCount: catalogMatch.seasonCount ?? metadata?.seasonCount,
      episodeCount: catalogMatch.episodeCount ?? metadata?.episodeCount,
      chapterCount: catalogMatch.chapterCount ?? metadata?.chapterCount,
      releaseYear: metadata?.releaseYear ?? catalogMatch.releaseYear,
      externalIds: buildExternalIds(catalogMatch.externalIds, metadata),
    }
  }

  updateEntry(
    catalog: CatalogEntry,
    input: {
      title?: string
      mediaType?: CatalogEntry['mediaType']
      metadataRefresh?: MetadataCard
    },
  ): CatalogEntry {
    const metadataRefresh = input.metadataRefresh
    const rawTitle = input.title?.trim()
    const refreshedTitle = metadataRefresh?.title?.trim()
    const nextTitle =
      rawTitle && rawTitle.length > 0
        ? rawTitle
        : refreshedTitle && refreshedTitle.length > 0
          ? refreshedTitle
          : catalog.title
    const shouldUpdateTitle = nextTitle !== catalog.title
    const mediaTypeChanged = input.mediaType !== undefined && input.mediaType !== catalog.mediaType

    return {
      ...catalog,
      title: shouldUpdateTitle ? nextTitle : catalog.title,
      normalizedTitle: shouldUpdateTitle ? normalizeTitle(nextTitle) : catalog.normalizedTitle,
      aliases: shouldUpdateTitle
        ? buildCatalogAliases(nextTitle, catalog)
        : catalog.aliases,
      seasonNumber:
        catalog.seasonNumber ??
        (metadataRefresh ? getMetadataSeasonNumber(metadataRefresh) : undefined),
      mediaType: input.mediaType ?? metadataRefresh?.mediaType ?? catalog.mediaType,
      metadataSyncStatus: metadataRefresh
        ? 'synced'
        : mediaTypeChanged
          ? 'pending'
          : catalog.metadataSyncStatus,
      score: metadataRefresh?.score ?? catalog.score,
      ...resolveCatalogPoster({
        metadata: metadataRefresh,
        existingCatalog: catalog,
        disableTemporaryPoster: true,
      }),
      backdrop: metadataRefresh?.backdrop ?? catalog.backdrop,
      genres:
        metadataRefresh && metadataRefresh.genres.length > 0
          ? metadataRefresh.genres
          : catalog.genres,
      description: metadataRefresh?.description ?? catalog.description,
      publicationStatus: metadataRefresh?.publicationStatus ?? catalog.publicationStatus,
      startDate: metadataRefresh?.startDate ?? catalog.startDate,
      endDate: metadataRefresh?.endDate ?? catalog.endDate,
      releaseYear: metadataRefresh?.releaseYear ?? catalog.releaseYear,
      runtime: metadataRefresh?.runtime ?? catalog.runtime,
      seasonCount: metadataRefresh?.seasonCount ?? catalog.seasonCount,
      episodeCount: metadataRefresh?.episodeCount ?? catalog.episodeCount,
      chapterCount: metadataRefresh?.chapterCount ?? catalog.chapterCount,
      externalIds: buildExternalIds(catalog.externalIds, metadataRefresh),
      updatedAt: nowIso(),
    }
  }
}
