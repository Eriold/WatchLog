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
  WatchLogSnapshot,
} from '../types'
import { normalizeTitle, slugify } from '../utils/normalize'
import { nowIso } from '../utils/time'
import type { StorageProvider } from './provider'

function createSourceEntry(detection: DetectionResult): SourceHistoryEntry {
  const detectedAt = nowIso()

  return {
    id: `${slugify(detection.sourceSite)}-${Date.now()}`,
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

function createCatalogEntry(detection: DetectionResult, metadata?: MetadataCard): CatalogEntry {
  const timestamp = nowIso()

  return {
    id: metadata?.id ?? `catalog-${slugify(detection.title)}-${Date.now()}`,
    title: metadata?.title ?? detection.title,
    normalizedTitle: metadata?.normalizedTitle ?? detection.normalizedTitle,
    mediaType: metadata?.mediaType ?? detection.mediaType,
    poster: metadata?.poster,
    backdrop: metadata?.backdrop,
    genres: metadata?.genres ?? [],
    description: metadata?.description,
    releaseYear: metadata?.releaseYear,
    runtime: metadata?.runtime,
    seasonCount: metadata?.seasonCount,
    episodeCount: metadata?.episodeCount,
    chapterCount: metadata?.chapterCount,
    externalIds: {},
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
    const metadata = await this.metadataProvider.findByNormalizedTitle(input.detection.normalizedTitle)
    const catalogMatch =
      snapshot.catalog.find((item) => {
        return (
          item.normalizedTitle === input.detection.normalizedTitle &&
          item.mediaType === (metadata?.mediaType ?? input.detection.mediaType)
        )
      }) ??
      snapshot.catalog.find((item) => item.normalizedTitle === input.detection.normalizedTitle)

    const catalog = catalogMatch
      ? {
          ...catalogMatch,
          updatedAt: nowIso(),
          poster: catalogMatch.poster ?? metadata?.poster,
          genres: catalogMatch.genres.length > 0 ? catalogMatch.genres : metadata?.genres ?? [],
          description: catalogMatch.description ?? metadata?.description,
          runtime: catalogMatch.runtime ?? metadata?.runtime,
          episodeCount: catalogMatch.episodeCount ?? metadata?.episodeCount,
          chapterCount: catalogMatch.chapterCount ?? metadata?.chapterCount,
        }
      : createCatalogEntry(input.detection, metadata)

    const source = createSourceEntry(input.detection)
    const existingActivity = snapshot.activity.find((item) => item.catalogId === catalog.id)
    const updatedActivity: ActivityEntry = existingActivity
      ? {
          ...existingActivity,
          status: input.listId,
          favorite: input.favorite ?? existingActivity.favorite,
          currentProgress: createProgressState(input.detection),
          lastSource: source,
          sourceHistory: dedupeHistory(existingActivity.sourceHistory, source),
          updatedAt: nowIso(),
        }
      : {
          catalogId: catalog.id,
          status: input.listId,
          favorite: input.favorite ?? false,
          currentProgress: createProgressState(input.detection),
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
      progressLabel: item.mediaType === 'movie' ? 'Pendiente' : 'Sin progreso',
      confidence: 1,
    }

    return this.saveDetection({
      detection,
      listId,
    })
  }

  async updateEntry(input: UpdateEntryInput): Promise<{ entry: LibraryEntry | null; snapshot: WatchLogSnapshot }> {
    const snapshot = await this.storageProvider.getSnapshot()
    const activity = snapshot.activity.find((item) => item.catalogId === input.catalogId)

    if (!activity) {
      return { entry: null, snapshot }
    }

    const updatedActivity: ActivityEntry = {
      ...activity,
      status: input.listId ?? activity.status,
      favorite: input.favorite ?? activity.favorite,
      manualNotes: input.manualNotes ?? activity.manualNotes,
      currentProgress: input.progress
        ? {
            ...activity.currentProgress,
            ...input.progress,
            progressText:
              input.progress.progressText ?? activity.currentProgress.progressText,
          }
        : activity.currentProgress,
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

  async addList(label: string): Promise<{ list: { id: string; label: string; kind: 'custom' }; snapshot: WatchLogSnapshot }> {
    const list = await this.storageProvider.addCustomList(label)
    const snapshot = await this.storageProvider.getSnapshot()
    return {
      list: {
        id: list.id,
        label: list.label,
        kind: 'custom',
      },
      snapshot,
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
      .filter((catalog) => catalog.normalizedTitle.includes(normalizedQuery))
      .map((catalog) => buildEntry(snapshot, catalog.id))
      .filter((entry): entry is LibraryEntry => Boolean(entry))
  }
}
