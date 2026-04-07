import type { MetadataProvider } from '../metadata/provider'
import type {
  ActivityEntry,
  CatalogEntry,
  DetectionResult,
  ExportActivityPayload,
  ExportCatalogPayload,
  LibraryEntry,
  MetadataCard,
  ProgressState,
  SaveDetectionInput,
  SourceHistoryEntry,
  UpdateEntryInput,
  WatchListDefinition,
  WatchLogSnapshot,
} from '../types'
import { hydrateDetectionWithMetadata } from '../metadata/detection-hydration'
import {
  areMediaTypesCompatible,
  getCatalogNormalizedTitles,
  getMetadataExternalIds,
  getMetadataNormalizedTitles,
  hasNormalizedTitleOverlap,
  mergeAlternativeTitles,
} from '../metadata/matching'
import { normalizeTitle, slugify } from '../utils/normalize'
import { nowIso } from '../utils/time'
import type { StorageProvider } from './provider'
import { getRandomTemporaryPoster, hasTemporaryPoster } from '../mock-posters'
import { getResolvedProgressState } from '../progress'
import {
  areSeasonNumbersCompatible,
  getCatalogSeasonNumber,
  getDetectionSeasonNumber,
  getMetadataSeasonNumber,
} from '../season'

function createUniqueId(prefix: string): string {
  const randomSuffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  return `${prefix}-${randomSuffix}`
}

function createSourceEntry(detection: DetectionResult): SourceHistoryEntry {
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

function buildExternalIds(
  existingExternalIds: Record<string, string>,
  metadata?: MetadataCard,
): Record<string, string> {
  return {
    ...existingExternalIds,
    ...getMetadataExternalIds(metadata),
  }
}

function getCatalogPrimaryTitle(
  detection: DetectionResult,
  metadata?: MetadataCard,
): string {
  return metadata?.title ?? detection.title
}

function getCatalogPrimaryNormalizedTitle(
  detection: DetectionResult,
  metadata?: MetadataCard,
): string {
  return metadata?.normalizedTitle ?? detection.normalizedTitle
}

function buildCatalogAliases(
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

function findCatalogMatch(
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
      hasNormalizedTitleOverlap(getCatalogNormalizedTitles(item), targetTitles)
    )
  })

  if (compatibleTitleMatch) {
    return compatibleTitleMatch
  }

  const detectionTitleMatch = snapshot.catalog.find((item) => {
    return (
      areMediaTypesCompatible(item.mediaType, detection.mediaType) &&
      areSeasonNumbersCompatible(getSnapshotCatalogSeasonNumber(item), targetSeasonNumber) &&
      hasNormalizedTitleOverlap(getCatalogNormalizedTitles(item), [detection.normalizedTitle])
    )
  })

  if (detectionTitleMatch) {
    return detectionTitleMatch
  }

  return snapshot.catalog.find((item) => {
    return (
      areSeasonNumbersCompatible(getSnapshotCatalogSeasonNumber(item), targetSeasonNumber) &&
      hasNormalizedTitleOverlap(getCatalogNormalizedTitles(item), targetTitles)
    )
  })
}

function createProgressState(detection: DetectionResult): ProgressState {
  return {
    season: detection.season,
    episode: detection.episode,
    episodeTotal: detection.episodeTotal,
    chapter: detection.chapter,
    chapterTotal: detection.chapterTotal,
    progressText: detection.progressLabel,
  }
}

function normalizeEntryProgress(
  progress: ProgressState,
  status: string,
  catalog: Pick<CatalogEntry, 'episodeCount' | 'chapterCount'>,
): ProgressState {
  return getResolvedProgressState(progress, status, {
    episodeCount: catalog.episodeCount,
    chapterCount: catalog.chapterCount,
  })
}

function createCatalogEntry(detection: DetectionResult, metadata?: MetadataCard): CatalogEntry {
  const timestamp = nowIso()
  const temporaryPoster = getRandomTemporaryPoster()
  const primaryTitle = getCatalogPrimaryTitle(detection, metadata)

  return {
    id: metadata?.id ?? createUniqueId(`catalog-${slugify(detection.title)}`),
    title: primaryTitle,
    normalizedTitle: getCatalogPrimaryNormalizedTitle(detection, metadata),
    aliases: buildCatalogAliases(primaryTitle, undefined, detection, metadata),
    seasonNumber: getDetectionSeasonNumber(detection) ?? (metadata ? getMetadataSeasonNumber(metadata) : undefined),
    mediaType: metadata?.mediaType ?? detection.mediaType,
    score: metadata?.score,
    poster: metadata?.poster ?? temporaryPoster,
    backdrop: metadata?.backdrop,
    genres: metadata?.genres ?? [],
    description: metadata?.description,
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

function dedupeHistory(
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

function buildEntry(snapshot: WatchLogSnapshot, catalogId: string): LibraryEntry | null {
  const catalog = snapshot.catalog.find((item) => item.id === catalogId)
  const activity = snapshot.activity.find((item) => item.catalogId === catalogId)

  if (!catalog || !activity) {
    return null
  }

  return { catalog, activity }
}

export class WatchLogRepository {
  private readonly storageProvider: StorageProvider
  private readonly metadataProvider: MetadataProvider

  constructor(storageProvider: StorageProvider, metadataProvider: MetadataProvider) {
    this.storageProvider = storageProvider
    this.metadataProvider = metadataProvider
  }

  async getSnapshot(): Promise<WatchLogSnapshot> {
    return this.storageProvider.getSnapshot()
  }

  async getExplorer(query?: string): Promise<MetadataCard[]> {
    return this.metadataProvider.search(query)
  }

  async saveDetection(input: SaveDetectionInput): Promise<{ entry: LibraryEntry; snapshot: WatchLogSnapshot }> {
    const snapshot = await this.storageProvider.getSnapshot()
    const metadata =
      input.metadata ??
      (await this.metadataProvider.findByNormalizedTitle(input.detection.normalizedTitle))
    const hydratedDetection = hydrateDetectionWithMetadata(input.detection, metadata)
    const catalogMatch = findCatalogMatch(snapshot, hydratedDetection, metadata)
    const primaryTitle = getCatalogPrimaryTitle(hydratedDetection, metadata)

    const catalog = catalogMatch
      ? {
          ...catalogMatch,
          title: primaryTitle,
          normalizedTitle: getCatalogPrimaryNormalizedTitle(hydratedDetection, metadata),
          aliases: buildCatalogAliases(primaryTitle, catalogMatch, hydratedDetection, metadata),
          seasonNumber:
            catalogMatch.seasonNumber ??
            getDetectionSeasonNumber(hydratedDetection) ??
            (metadata ? getMetadataSeasonNumber(metadata) : undefined),
          mediaType: metadata?.mediaType ?? catalogMatch.mediaType,
          score: metadata?.score ?? catalogMatch.score,
          updatedAt: nowIso(),
          poster:
            (catalogMatch.poster && !hasTemporaryPoster(catalogMatch.poster)
              ? catalogMatch.poster
              : metadata?.poster) ??
            catalogMatch.poster ??
            getRandomTemporaryPoster(),
          backdrop: catalogMatch.backdrop ?? metadata?.backdrop,
          genres: catalogMatch.genres.length > 0 ? catalogMatch.genres : metadata?.genres ?? [],
          description: catalogMatch.description ?? metadata?.description,
          runtime: catalogMatch.runtime ?? metadata?.runtime,
          seasonCount: catalogMatch.seasonCount ?? metadata?.seasonCount,
          episodeCount: catalogMatch.episodeCount ?? metadata?.episodeCount,
          chapterCount: catalogMatch.chapterCount ?? metadata?.chapterCount,
          releaseYear: catalogMatch.releaseYear ?? metadata?.releaseYear,
          externalIds: buildExternalIds(catalogMatch.externalIds, metadata),
        }
      : createCatalogEntry(hydratedDetection, metadata)

    const source = createSourceEntry(hydratedDetection)
    const existingActivity = snapshot.activity.find((item) => item.catalogId === catalog.id)
    const nextStatus = input.listId
    const updatedActivity: ActivityEntry = existingActivity
      ? {
          ...existingActivity,
          status: nextStatus,
          favorite: input.favorite ?? existingActivity.favorite,
          currentProgress: normalizeEntryProgress(
            createProgressState(hydratedDetection),
            nextStatus,
            catalog,
          ),
          lastSource: source,
          sourceHistory: dedupeHistory(existingActivity.sourceHistory, source),
          updatedAt: nowIso(),
        }
      : {
          catalogId: catalog.id,
          status: nextStatus,
          favorite: input.favorite ?? false,
          currentProgress: normalizeEntryProgress(
            createProgressState(hydratedDetection),
            nextStatus,
            catalog,
          ),
          lastSource: source,
          sourceHistory: [source],
          manualNotes: '',
          tags: [],
          createdAt: nowIso(),
          updatedAt: nowIso(),
        }

    const nextSnapshot: WatchLogSnapshot = {
      ...snapshot,
      catalog: catalogMatch
        ? snapshot.catalog.map((item) => (item.id === catalog.id ? catalog : item))
        : [...snapshot.catalog, catalog],
      activity: existingActivity
        ? snapshot.activity.map((item) => (item.catalogId === catalog.id ? updatedActivity : item))
        : [...snapshot.activity, updatedActivity],
    }

    await this.storageProvider.saveSnapshot(nextSnapshot)

    return {
      entry: { catalog, activity: updatedActivity },
      snapshot: nextSnapshot,
    }
  }

  async addFromMetadata(item: MetadataCard, listId: string): Promise<{ entry: LibraryEntry; snapshot: WatchLogSnapshot }> {
    const detection: DetectionResult = {
      title: item.title,
      normalizedTitle: item.normalizedTitle,
      mediaType: item.mediaType,
      sourceSite: 'Explorer',
      url: '',
      favicon: '',
      pageTitle: item.title,
      episodeTotal: item.episodeCount,
      chapterTotal: item.chapterCount,
      progressLabel: item.mediaType === 'movie' ? 'Pendiente' : 'Sin progreso',
      confidence: 1,
    }

    return this.saveDetection({
      detection,
      listId,
      metadata: item,
    })
  }

  async updateEntry(input: UpdateEntryInput): Promise<{ entry: LibraryEntry | null; snapshot: WatchLogSnapshot }> {
    const snapshot = await this.storageProvider.getSnapshot()
    const activity = snapshot.activity.find((item) => item.catalogId === input.catalogId)
    const catalog = snapshot.catalog.find((item) => item.id === input.catalogId)

    if (!activity || !catalog) {
      return { entry: null, snapshot }
    }

    const nextStatus = input.listId ?? activity.status
    const nextProgress = input.progress
      ? {
          ...activity.currentProgress,
          ...input.progress,
          progressText:
            input.progress.progressText ?? activity.currentProgress.progressText,
        }
      : activity.currentProgress

    const updatedActivity: ActivityEntry = {
      ...activity,
      status: nextStatus,
      favorite: input.favorite ?? activity.favorite,
      manualNotes: input.manualNotes ?? activity.manualNotes,
      currentProgress: normalizeEntryProgress(nextProgress, nextStatus, catalog),
      updatedAt: nowIso(),
    }

    const nextSnapshot: WatchLogSnapshot = {
      ...snapshot,
      activity: snapshot.activity.map((item) =>
        item.catalogId === input.catalogId ? updatedActivity : item,
      ),
    }

    await this.storageProvider.saveSnapshot(nextSnapshot)

    return {
      entry: buildEntry(nextSnapshot, input.catalogId),
      snapshot: nextSnapshot,
    }
  }

  async removeEntry(
    catalogId: string,
  ): Promise<{ removedCatalogId: string; snapshot: WatchLogSnapshot }> {
    const snapshot = await this.storageProvider.getSnapshot()
    const catalogExists = snapshot.catalog.some((item) => item.id === catalogId)

    if (!catalogExists) {
      throw new Error('Entry not found.')
    }

    const nextSnapshot: WatchLogSnapshot = {
      ...snapshot,
      catalog: snapshot.catalog.filter((item) => item.id !== catalogId),
      activity: snapshot.activity.filter((item) => item.catalogId !== catalogId),
    }

    await this.storageProvider.saveSnapshot(nextSnapshot)

    return {
      removedCatalogId: catalogId,
      snapshot: nextSnapshot,
    }
  }

  async addList(label: string): Promise<{ list: { id: string; label: string; kind: 'custom' }; snapshot: WatchLogSnapshot }> {
    console.log('[WatchLog] repository:addList:start', { label })
    const list = await this.storageProvider.addCustomList(label)
    const snapshot = await this.storageProvider.getSnapshot()
    console.log('[WatchLog] repository:addList:result', {
      list,
      snapshotLists: snapshot.lists,
    })
    return {
      list: {
        id: list.id,
        label: list.label,
        kind: 'custom',
      },
      snapshot,
    }
  }

  async removeList(
    listId: string,
  ): Promise<{ removedListId: string; fallbackListId: string; snapshot: WatchLogSnapshot }> {
    const fallbackListId = 'library'
    const snapshot = await this.storageProvider.getSnapshot()
    const targetList = snapshot.lists.find((list) => list.id === listId)

    if (!targetList) {
      throw new Error('List not found.')
    }

    if (targetList.kind !== 'custom') {
      throw new Error('System lists cannot be removed.')
    }

    const nextSnapshot: WatchLogSnapshot = {
      ...snapshot,
      lists: snapshot.lists.filter((list) => list.id !== listId),
      activity: snapshot.activity.map((entry) =>
        entry.status === listId
          ? {
              ...entry,
              status: fallbackListId,
              updatedAt: nowIso(),
            }
          : entry,
      ),
    }

    await this.storageProvider.saveSnapshot(nextSnapshot)

    return {
      removedListId: listId,
      fallbackListId,
      snapshot: nextSnapshot,
    }
  }

  async updateList(
    listId: string,
    label: string,
  ): Promise<{ list: WatchListDefinition; snapshot: WatchLogSnapshot }> {
    const snapshot = await this.storageProvider.getSnapshot()
    const targetList = snapshot.lists.find((list) => list.id === listId)

    if (!targetList) {
      throw new Error('List not found.')
    }

    if (targetList.kind !== 'custom') {
      throw new Error('System lists cannot be renamed.')
    }

    const trimmedLabel = label.trim()
    if (!trimmedLabel) {
      throw new Error('List label cannot be empty.')
    }

    const updatedList: WatchListDefinition = {
      ...targetList,
      label: trimmedLabel,
      updatedAt: nowIso(),
    }

    const nextSnapshot: WatchLogSnapshot = {
      ...snapshot,
      lists: snapshot.lists.map((list) => (list.id === listId ? updatedList : list)),
    }

    await this.storageProvider.saveSnapshot(nextSnapshot)

    return {
      list: updatedList,
      snapshot: nextSnapshot,
    }
  }

  async clearList(
    listId: string,
  ): Promise<{ clearedListId: string; removedCatalogIds: string[]; snapshot: WatchLogSnapshot }> {
    const snapshot = await this.storageProvider.getSnapshot()
    const targetList = snapshot.lists.find((list) => list.id === listId)

    if (!targetList) {
      throw new Error('List not found.')
    }

    const removedCatalogIds = snapshot.activity
      .filter((entry) => entry.status === listId)
      .map((entry) => entry.catalogId)

    const removedCatalogIdSet = new Set(removedCatalogIds)

    const nextSnapshot: WatchLogSnapshot = {
      ...snapshot,
      activity: snapshot.activity.filter((entry) => entry.status !== listId),
      catalog: snapshot.catalog.filter((entry) => !removedCatalogIdSet.has(entry.id)),
      lists: snapshot.lists.map((list) =>
        list.id === listId
          ? {
              ...list,
              updatedAt: nowIso(),
            }
          : list,
      ),
    }

    await this.storageProvider.saveSnapshot(nextSnapshot)

    return {
      clearedListId: listId,
      removedCatalogIds,
      snapshot: nextSnapshot,
    }
  }

  async exportCatalog(): Promise<ExportCatalogPayload> {
    return this.storageProvider.exportCatalog()
  }

  async exportActivity(): Promise<ExportActivityPayload> {
    return this.storageProvider.exportActivity()
  }

  async importBackup(
    catalogPayload: ExportCatalogPayload,
    activityPayload: ExportActivityPayload,
  ): Promise<WatchLogSnapshot> {
    return this.storageProvider.importBackup(catalogPayload, activityPayload)
  }

  async searchCatalogByTitle(query: string): Promise<LibraryEntry[]> {
    const snapshot = await this.storageProvider.getSnapshot()
    const normalizedQuery = normalizeTitle(query)

    return snapshot.catalog
      .filter((catalog) =>
        getCatalogNormalizedTitles(catalog).some((title) => title.includes(normalizedQuery)),
      )
      .map((catalog) => buildEntry(snapshot, catalog.id))
      .filter((entry): entry is LibraryEntry => Boolean(entry))
  }
}
