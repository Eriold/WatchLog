import type {
  ActiveDetectionResponse,
  AddListResponse,
  ClearListResponse,
  ExplorerResponse,
  ExportActivityResponse,
  ExportCatalogResponse,
  LibraryResponse,
  RemoveEntryResponse,
  RemoveListResponse,
  SaveDetectionResponse,
  UpdateListResponse,
  UpdateEntryResponse,
  WatchLogMessage,
} from './messages'
import { createMetadataProvider } from './metadata/create-provider'
import { AniListMetadataProvider } from './metadata/anilist-provider'
import { getTranslatedTitleCandidates } from './metadata/title-translation'
import { getSiteTitleAliasCandidates } from './detection/site-title-aliases'
import { LocalStorageProvider } from './storage/local-storage-provider'
import { WatchLogRepository } from './storage/repository'
import type {
  CatalogEntry,
  ExportActivityPayload,
  ExportCatalogPayload,
  DetectionResult,
  SaveDetectionInput,
  UpdateEntryInput,
} from './types'
import {
  areMediaTypesCompatible,
  getDetectionMediaTypeHints,
  pickBestMetadataMatch,
} from './metadata/matching'
import { getDetectionSeasonNumber } from './season'
import { sendRuntimeMessage } from './storage/browser'
import { normalizeTitle } from './utils/normalize'

const metadataProvider = createMetadataProvider()
const aniListMetadataProvider = new AniListMetadataProvider()
const repository = new WatchLogRepository(new LocalStorageProvider(), metadataProvider)
const ANILIST_REFRESH_LOG_PREFIX = '[WatchLog][AniListRefresh]'

function getAniListSearchType(mediaType: DetectionResult['mediaType']) {
  if (mediaType === 'anime') {
    return 'ANIME' as const
  }

  if (['manga', 'manhwa', 'manhua'].includes(mediaType)) {
    return 'MANGA' as const
  }

  return null
}

async function resolveAniListMetadata(detection: DetectionResult) {
  const searchType = getAniListSearchType(detection.mediaType)
  if (!searchType) {
    console.warn(`${ANILIST_REFRESH_LOG_PREFIX} Unsupported media type`, {
      title: detection.title,
      mediaType: detection.mediaType,
    })
    return undefined
  }

  console.info(`${ANILIST_REFRESH_LOG_PREFIX} Resolve start`, {
    title: detection.title,
    normalizedTitle: detection.normalizedTitle,
    mediaType: detection.mediaType,
    searchType,
    sourceSite: detection.sourceSite,
  })

  const translatedTitleCandidates = await getTranslatedTitleCandidates(detection.title)
  const englishTitleCandidates = translatedTitleCandidates.filter(
    (candidate) => normalizeTitle(candidate) !== detection.normalizedTitle,
  )
  const orderedTitleSeeds = [detection.title, ...englishTitleCandidates]
  const translatedQueryKeys = new Set(
    englishTitleCandidates.map((candidate) => normalizeTitle(candidate)).filter(Boolean),
  )

  const queries: string[] = []
  const seenQueries = new Set<string>()
  const addQuery = (value: string | undefined | null) => {
    const trimmed = value?.trim()
    const normalized = trimmed ? normalizeTitle(trimmed) : ''
    if (!trimmed || !normalized || seenQueries.has(normalized)) {
      return
    }

    seenQueries.add(normalized)
    queries.push(trimmed)
  }

  for (const titleCandidate of orderedTitleSeeds) {
    addQuery(titleCandidate)
  }

  addQuery(detection.normalizedTitle)
  addQuery(normalizeTitle(detection.title))

  if (detection.season !== undefined) {
    addQuery(`${detection.title} ${detection.season}`)
    addQuery(`${detection.title} season ${detection.season}`)
  }

  console.info(`${ANILIST_REFRESH_LOG_PREFIX} Query plan`, {
    title: detection.title,
    translatedTitleCandidates,
    queries,
  })

  const preferredMediaTypes =
    searchType === 'ANIME' ? (['anime'] as const) : (['manga', 'manhwa', 'manhua'] as const)
  const preferredSeason = getDetectionSeasonNumber(detection)

  for (const query of queries) {
    console.info(`${ANILIST_REFRESH_LOG_PREFIX} Query start`, {
      title: detection.title,
      searchType,
      query,
    })
    const items = await aniListMetadataProvider.searchByType(query, searchType, {
      bypassCache: true,
    })
    console.info(`${ANILIST_REFRESH_LOG_PREFIX} Query results`, {
      title: detection.title,
      searchType,
      query,
      results: items.length,
      ids: items.map((item) => item.id),
      titles: items.map((item) => item.title),
    })
    if (items.length === 0) {
      continue
    }

    const titleCandidates = [detection.title, ...translatedTitleCandidates, query]
    for (const titleCandidate of titleCandidates) {
      const picked = pickBestMetadataMatch(
        items,
        titleCandidate,
        [...preferredMediaTypes],
        preferredSeason,
      )
      if (picked) {
        console.info(`${ANILIST_REFRESH_LOG_PREFIX} Match selected`, {
          title: detection.title,
          query,
          titleCandidate,
          pickedId: picked.id,
          pickedTitle: picked.title,
          pickedSourceUrl: picked.sourceUrl,
        })
        return picked
      }
    }

    if (translatedQueryKeys.has(normalizeTitle(query))) {
      const rankedFallback =
        items.find((item) =>
          areMediaTypesCompatible(item.mediaType, detection.mediaType),
        ) ?? items[0]

      if (rankedFallback) {
        console.warn(`${ANILIST_REFRESH_LOG_PREFIX} Using AniList ranked fallback`, {
          title: detection.title,
          query,
          pickedId: rankedFallback.id,
          pickedTitle: rankedFallback.title,
          pickedSourceUrl: rankedFallback.sourceUrl,
        })
        return rankedFallback
      }
    }
  }

  console.info(`${ANILIST_REFRESH_LOG_PREFIX} Fallback normalized-title lookup`, {
    title: detection.title,
    normalizedTitle: detection.normalizedTitle,
    searchType,
  })
  const fallback = await aniListMetadataProvider.findByNormalizedTitleForType(
    detection.normalizedTitle,
    searchType,
    {
      bypassCache: true,
    },
  )
  console.info(`${ANILIST_REFRESH_LOG_PREFIX} Fallback result`, {
    title: detection.title,
    pickedId: fallback?.id ?? null,
    pickedTitle: fallback?.title ?? null,
    pickedSourceUrl: fallback?.sourceUrl ?? null,
  })
  return fallback
}

export async function getActiveDetection(tabId?: number) {
  return sendRuntimeMessage<ActiveDetectionResponse>({
    type: 'watchlog/get-active-detection',
    payload: { tabId },
  } satisfies WatchLogMessage)
}

export async function reanalyzeActiveDetection(tabId?: number) {
  return sendRuntimeMessage<ActiveDetectionResponse>({
    type: 'watchlog/reanalyze-active-detection',
    payload: { tabId },
  } satisfies WatchLogMessage)
}

export async function saveDetection(payload: SaveDetectionInput) {
  return repository.saveDetection(payload) as Promise<SaveDetectionResponse>
}

export async function resolveDetectionMetadata(detection: DetectionResult) {
  const preferTranslatedSearch = /olympusbiblioteca\.com/i.test(detection.sourceSite)
  const siteAliases = await getSiteTitleAliasCandidates(detection.sourceSite, detection.title)
  const translatedTitleCandidates = await getTranslatedTitleCandidates(detection.title)
  const englishTitleCandidates = translatedTitleCandidates.filter(
    (candidate) => normalizeTitle(candidate) !== detection.normalizedTitle,
  )
  const orderedTitleSeeds = preferTranslatedSearch
    ? [...englishTitleCandidates, ...siteAliases, detection.title]
    : [detection.title, ...englishTitleCandidates, ...siteAliases]

  const queries: string[] = []
  const seenQueries = new Set<string>()
  const addQuery = (value: string | undefined | null) => {
    const trimmed = value?.trim()
    const normalized = trimmed ? normalizeTitle(trimmed) : ''
    if (!trimmed || !normalized || seenQueries.has(normalized)) {
      return
    }

    seenQueries.add(normalized)
    queries.push(trimmed)
  }

  for (const titleCandidate of orderedTitleSeeds) {
    addQuery(titleCandidate)
    addQuery(normalizeTitle(titleCandidate))
  }

  addQuery(detection.normalizedTitle)
  addQuery(normalizeTitle(detection.title))

  if (detection.season !== undefined) {
    queries.push(`${detection.title} ${detection.season}`)
    queries.push(`${detection.title} season ${detection.season}`)
  }

  const preferredMediaTypes = getDetectionMediaTypeHints(detection)
  const preferredSeason = getDetectionSeasonNumber(detection)

  for (const query of queries) {
    const items = await metadataProvider.search(query)
    if (items.length === 0) {
      continue
    }

    const titleCandidates = [detection.title, ...translatedTitleCandidates, query]
    for (const titleCandidate of titleCandidates) {
      const picked = pickBestMetadataMatch(
        items,
        titleCandidate,
        preferredMediaTypes,
        preferredSeason,
      )
      if (picked) {
        return picked
      }
    }
  }

  const normalizedMatch = await metadataProvider.findByNormalizedTitle(detection.normalizedTitle)
  return normalizedMatch
}

export async function refreshAniListMetadata(detection: DetectionResult) {
  return resolveAniListMetadata(detection)
}

export async function addFromExplorer(metadataId: string, listId: string) {
  const item = await metadataProvider.getById(metadataId)

  if (!item) {
    throw new Error('Explorer item not found.')
  }

  return repository.addFromMetadata(item, listId) as Promise<SaveDetectionResponse>
}

export async function getMetadataForCatalogEntry(
  catalog: Pick<CatalogEntry, 'mediaType' | 'normalizedTitle' | 'externalIds'>,
) {
  const mangaDexId = catalog.externalIds.mangadex
  if (mangaDexId) {
    const metadata = await metadataProvider.getById(`mangadex:${mangaDexId}`)
    if (metadata) {
      return metadata
    }
  }

  const aniListId = catalog.externalIds.anilist

  if (aniListId) {
    const metadata = await metadataProvider.getById(`anilist:${aniListId}`)
    if (metadata) {
      return metadata
    }
  }

  if (!['anime', 'manga', 'manhwa', 'manhua'].includes(catalog.mediaType)) {
    return undefined
  }

  return metadataProvider.findByNormalizedTitle(catalog.normalizedTitle)
}

export async function getLibrary() {
  return {
    snapshot: await repository.getSnapshot(),
  } satisfies LibraryResponse
}

export async function getExplorer(query?: string) {
  return {
    items: await repository.getExplorer(query),
  } satisfies ExplorerResponse
}

export async function updateEntry(payload: UpdateEntryInput) {
  return repository.updateEntry(payload) as Promise<UpdateEntryResponse>
}

export async function removeEntry(catalogId: string) {
  return repository.removeEntry(catalogId) as Promise<RemoveEntryResponse>
}

export async function addList(label: string) {
  return repository.addList(label) as Promise<AddListResponse>
}

export async function removeList(listId: string) {
  return repository.removeList(listId) as Promise<RemoveListResponse>
}

export async function updateList(listId: string, label: string) {
  return repository.updateList(listId, label) as Promise<UpdateListResponse>
}

export async function clearList(listId: string) {
  return repository.clearList(listId) as Promise<ClearListResponse>
}

export async function exportCatalog() {
  return {
    payload: await repository.exportCatalog(),
  } satisfies ExportCatalogResponse
}

export async function exportActivity() {
  return {
    payload: await repository.exportActivity(),
  } satisfies ExportActivityResponse
}

export async function importBackup(
  catalog: ExportCatalogPayload,
  activity: ExportActivityPayload,
) {
  return {
    snapshot: await repository.importBackup(catalog, activity),
  } satisfies LibraryResponse
}
