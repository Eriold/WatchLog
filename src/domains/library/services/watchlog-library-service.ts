import { hydrateDetectionWithMetadata } from '../../../shared/metadata/detection-hydration'
import type { MetadataProvider } from '../../../shared/metadata/provider'
import type { StorageProvider } from '../../../shared/storage/provider'
import type {
  ExportActivityPayload,
  ExportCatalogPayload,
  LibraryEntry,
  MetadataCard,
  SaveDetectionInput,
  UpdateEntryInput,
  WatchListDefinition,
  WatchLogSnapshot,
} from '../../../shared/types'
import { normalizeTitle } from '../../../shared/utils/normalize'
import { ActivityRepository } from '../storage/activity-repository'
import { CatalogRepository } from '../storage/catalog-repository'
import { ListRepository } from '../storage/list-repository'

export class WatchLogLibraryService {
  private readonly storageProvider: StorageProvider
  private readonly metadataProvider: MetadataProvider
  private readonly catalogRepository: CatalogRepository
  private readonly activityRepository: ActivityRepository
  private readonly listRepository: ListRepository

  constructor(storageProvider: StorageProvider, metadataProvider: MetadataProvider) {
    this.storageProvider = storageProvider
    this.metadataProvider = metadataProvider
    this.catalogRepository = new CatalogRepository()
    this.activityRepository = new ActivityRepository()
    this.listRepository = new ListRepository(storageProvider)
  }

  async getSnapshot(): Promise<WatchLogSnapshot> {
    return this.storageProvider.getSnapshot()
  }

  async getExplorer(query?: string): Promise<MetadataCard[]> {
    return this.metadataProvider.search(query)
  }

  async saveDetection(
    input: SaveDetectionInput,
  ): Promise<{ entry: LibraryEntry; snapshot: WatchLogSnapshot }> {
    const snapshot = await this.storageProvider.getSnapshot()
    const metadata =
      input.metadata ??
      (input.skipMetadataLookup
        ? undefined
        : await this.metadataProvider.findByNormalizedTitle(input.detection.normalizedTitle))
    const hydratedDetection = hydrateDetectionWithMetadata(input.detection, metadata)
    const catalogMatch = this.catalogRepository.findMatch(snapshot, hydratedDetection, metadata)
    const nextMetadataSyncStatus = metadata
      ? 'synced'
      : catalogMatch?.metadataSyncStatus ?? input.metadataSyncStatus

    const catalog = catalogMatch
      ? this.catalogRepository.mergeDetectedCatalog({
          catalogMatch,
          detection: hydratedDetection,
          metadata,
          posterOverride: input.posterOverride,
          metadataSyncStatus: nextMetadataSyncStatus,
          disableTemporaryPoster: input.disableTemporaryPoster,
        })
      : this.catalogRepository.createEntry(
          hydratedDetection,
          metadata,
          input.posterOverride,
          nextMetadataSyncStatus,
          input.disableTemporaryPoster,
        )

    const updatedActivity = this.activityRepository.saveDetectionActivity({
      snapshot,
      catalog,
      detection: hydratedDetection,
      listId: input.listId,
      favorite: input.favorite,
    })

    const nextSnapshot: WatchLogSnapshot = {
      ...snapshot,
      catalog: catalogMatch
        ? snapshot.catalog.map((item) => (item.id === catalog.id ? catalog : item))
        : [...snapshot.catalog, catalog],
      activity: this.activityRepository.mergeDetectionActivity(snapshot, catalog, updatedActivity),
    }

    await this.storageProvider.saveSnapshot(nextSnapshot)

    return {
      entry: { catalog, activity: updatedActivity },
      snapshot: nextSnapshot,
    }
  }

  async addFromMetadata(
    item: MetadataCard,
    listId: string,
  ): Promise<{ entry: LibraryEntry; snapshot: WatchLogSnapshot }> {
    return this.saveDetection({
      detection: {
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
      },
      listId,
      metadata: item,
    })
  }

  async updateEntry(
    input: UpdateEntryInput,
  ): Promise<{ entry: LibraryEntry | null; snapshot: WatchLogSnapshot }> {
    const snapshot = await this.storageProvider.getSnapshot()
    const activity = snapshot.activity.find((item) => item.catalogId === input.catalogId)
    const catalog = snapshot.catalog.find((item) => item.id === input.catalogId)

    if (!activity || !catalog) {
      return { entry: null, snapshot }
    }

    const updatedCatalog = this.catalogRepository.updateEntry(catalog, {
      title: input.title,
      mediaType: input.mediaType,
      metadataRefresh: input.metadataRefresh,
    })
    const updatedActivity = this.activityRepository.updateEntryActivity(
      activity,
      updatedCatalog,
      input,
    )

    const nextSnapshot: WatchLogSnapshot = {
      ...snapshot,
      catalog: snapshot.catalog.map((item) =>
        item.id === input.catalogId ? updatedCatalog : item,
      ),
      activity: snapshot.activity.map((item) =>
        item.catalogId === input.catalogId ? updatedActivity : item,
      ),
    }

    await this.storageProvider.saveSnapshot(nextSnapshot)

    return {
      entry: this.activityRepository.buildEntry(nextSnapshot, input.catalogId),
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

  async addList(
    label: string,
  ): Promise<{ list: Pick<WatchListDefinition, 'id' | 'label' | 'kind'>; snapshot: WatchLogSnapshot }> {
    const response = await this.listRepository.addList(label)

    return {
      list: {
        id: response.list.id,
        label: response.list.label,
        kind: 'custom',
      },
      snapshot: response.snapshot,
    }
  }

  async removeList(
    listId: string,
  ): Promise<{ removedListId: string; fallbackListId: string; snapshot: WatchLogSnapshot }> {
    const fallbackListId = 'library'
    const snapshot = await this.storageProvider.getSnapshot()
    const result = this.listRepository.removeList(snapshot, listId, fallbackListId)

    const nextSnapshot: WatchLogSnapshot = {
      ...result.snapshot,
      activity: this.activityRepository.reassignList(snapshot.activity, listId, fallbackListId),
    }

    await this.storageProvider.saveSnapshot(nextSnapshot)

    return {
      removedListId: result.removedListId,
      fallbackListId: result.fallbackListId,
      snapshot: nextSnapshot,
    }
  }

  async updateList(
    listId: string,
    label: string,
  ): Promise<{ list: WatchListDefinition; snapshot: WatchLogSnapshot }> {
    const snapshot = await this.storageProvider.getSnapshot()
    const result = this.listRepository.updateList(snapshot, listId, label)

    await this.storageProvider.saveSnapshot(result.snapshot)

    return result
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
              updatedAt: new Date().toISOString(),
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
      .filter((catalog) => {
        const candidateTitles = [
          catalog.normalizedTitle,
          ...(catalog.aliases ?? []).map((title) => normalizeTitle(title)),
        ]

        return candidateTitles.some((title) => title.includes(normalizedQuery))
      })
      .map((catalog) => this.activityRepository.buildEntry(snapshot, catalog.id))
      .filter((entry): entry is LibraryEntry => Boolean(entry))
  }
}
