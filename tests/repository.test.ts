import { describe, expect, it } from 'vitest'
import { MockMetadataProvider } from '../src/shared/metadata/mock-provider'
import type {
  ExportActivityPayload,
  ExportCatalogPayload,
  WatchListDefinition,
  WatchLogSnapshot,
} from '../src/shared/types'
import type { StorageProvider } from '../src/shared/storage/provider'
import { WatchLogRepository } from '../src/shared/storage/repository'

class MemoryStorageProvider implements StorageProvider {
  private snapshot: WatchLogSnapshot = {
    catalog: [],
    activity: [],
    lists: [
      { id: 'library', label: 'Library', kind: 'system' },
      { id: 'watching', label: 'Viendo', kind: 'system' },
      { id: 'completed', label: 'Finalizado', kind: 'system' },
    ],
  }

  async getSnapshot(): Promise<WatchLogSnapshot> {
    return structuredClone(this.snapshot)
  }

  async saveSnapshot(snapshot: WatchLogSnapshot): Promise<void> {
    this.snapshot = structuredClone(snapshot)
  }

  async addCustomList(label: string): Promise<WatchListDefinition> {
    const list = {
      id: label.toLowerCase().replace(/\s+/g, '-'),
      label,
      kind: 'custom' as const,
    }

    this.snapshot.lists.push(list)
    return list
  }

  async exportCatalog(): Promise<ExportCatalogPayload> {
    return {
      schemaVersion: 1,
      exportedAt: '2026-04-05T00:00:00.000Z',
      catalog: structuredClone(this.snapshot.catalog),
    }
  }

  async exportActivity(): Promise<ExportActivityPayload> {
    return {
      schemaVersion: 1,
      exportedAt: '2026-04-05T00:00:00.000Z',
      lists: structuredClone(this.snapshot.lists),
      activity: structuredClone(this.snapshot.activity),
    }
  }

  async importBackup(
    catalogPayload: ExportCatalogPayload,
    activityPayload: ExportActivityPayload,
  ): Promise<WatchLogSnapshot> {
    this.snapshot = {
      catalog: structuredClone(catalogPayload.catalog),
      activity: structuredClone(activityPayload.activity),
      lists: structuredClone(activityPayload.lists),
    }

    return structuredClone(this.snapshot)
  }
}

describe('WatchLogRepository', () => {
  it('keeps one catalog entry and multiple source history items', async () => {
    const repository = new WatchLogRepository(
      new MemoryStorageProvider(),
      new MockMetadataProvider(),
    )

    await repository.saveDetection({
      listId: 'watching',
      detection: {
        title: 'The Big Bang Theory',
        normalizedTitle: 'the big bang theory',
        mediaType: 'series',
        sourceSite: 'Netflix',
        url: 'https://www.netflix.com/watch/111',
        favicon: 'https://www.netflix.com/favicon.ico',
        pageTitle: 'The Big Bang Theory S3 E5 | Netflix',
        season: 3,
        episode: 5,
        progressLabel: 'S3 5/24',
        confidence: 0.9,
      },
    })

    const response = await repository.saveDetection({
      listId: 'watching',
      detection: {
        title: 'The Big Bang Theory',
        normalizedTitle: 'the big bang theory',
        mediaType: 'series',
        sourceSite: 'Max',
        url: 'https://play.max.com/show/222',
        favicon: 'https://play.max.com/favicon.ico',
        pageTitle: 'The Big Bang Theory S3 E6 | Max',
        season: 3,
        episode: 6,
        progressLabel: 'S3 6/24',
        confidence: 0.86,
      },
    })

    expect(response.snapshot.catalog).toHaveLength(1)
    expect(response.snapshot.activity).toHaveLength(1)
    expect(response.entry.activity.sourceHistory).toHaveLength(2)
    expect(response.entry.activity.lastSource?.siteName).toBe('Max')
  })

  it('creates custom lists and updates activity state', async () => {
    const repository = new WatchLogRepository(
      new MemoryStorageProvider(),
      new MockMetadataProvider(),
    )

    const saved = await repository.addFromMetadata(
      {
        id: 'matrix',
        title: 'The Matrix',
        normalizedTitle: 'the matrix',
        mediaType: 'movie',
        genres: ['Action'],
        description: 'Mock',
      },
      'library',
    )

    const custom = await repository.addList('Weekend')
    const updated = await repository.updateEntry({
      catalogId: saved.entry.catalog.id,
      listId: custom.list.id,
      favorite: true,
      progress: {
        progressText: 'Ready for Saturday',
      },
    })

    expect(custom.snapshot.lists.some((list) => list.id === 'weekend')).toBe(true)
    expect(updated.entry?.activity.status).toBe('weekend')
    expect(updated.entry?.activity.favorite).toBe(true)
    expect(updated.entry?.activity.currentProgress.progressText).toBe('Ready for Saturday')
  })

  it('assigns a temporary poster when metadata is not available yet', async () => {
    const repository = new WatchLogRepository(
      new MemoryStorageProvider(),
      new MockMetadataProvider(),
    )

    const response = await repository.saveDetection({
      listId: 'watching',
      detection: {
        title: 'Signal Unknown',
        normalizedTitle: 'signal unknown',
        mediaType: 'series',
        sourceSite: 'animeav1.com',
        url: 'https://animeav1.com/media/signal-unknown/1',
        favicon: 'https://animeav1.com/favicon.ico',
        pageTitle: 'Signal Unknown Episodio 1',
        episode: 1,
        progressLabel: 'Ep 1',
        confidence: 0.65,
      },
    })

    expect(response.entry.catalog.poster).toContain('WatchLogTemporaryPoster')
  })
})
