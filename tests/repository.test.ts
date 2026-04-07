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
    const timestamp = '2026-04-05T00:00:00.000Z'
    const list = {
      id: label.toLowerCase().replace(/\s+/g, '-'),
      label,
      kind: 'custom' as const,
      createdAt: timestamp,
      updatedAt: timestamp,
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

  it('preserves explicit explorer metadata when saving from a real provider', async () => {
    const repository = new WatchLogRepository(
      new MemoryStorageProvider(),
      new MockMetadataProvider(),
    )

    const response = await repository.addFromMetadata(
      {
        id: 'anilist:21',
        title: 'One Piece',
        normalizedTitle: 'one piece',
        mediaType: 'anime',
        poster: 'https://img.anilist.co/one-piece.jpg',
        backdrop: 'https://img.anilist.co/one-piece-banner.jpg',
        genres: ['Adventure', 'Shounen'],
        description: 'Real AniList metadata',
        episodeCount: 1122,
        score: 8.8,
      },
      'library',
    )

    expect(response.entry.catalog.id).toBe('anilist:21')
    expect(response.entry.catalog.poster).toBe('https://img.anilist.co/one-piece.jpg')
    expect(response.entry.catalog.backdrop).toBe('https://img.anilist.co/one-piece-banner.jpg')
    expect(response.entry.catalog.description).toBe('Real AniList metadata')
    expect(response.entry.catalog.episodeCount).toBe(1122)
    expect(response.entry.activity.currentProgress.progressText).toBe('0/1122')
    expect(response.entry.activity.currentProgress.episodeTotal).toBe(1122)
  })

  it('removes custom lists and reassigns their entries to library', async () => {
    const repository = new WatchLogRepository(
      new MemoryStorageProvider(),
      new MockMetadataProvider(),
    )

    const custom = await repository.addList('Weekend')
    const saved = await repository.addFromMetadata(
      {
        id: 'akira',
        title: 'Akira',
        normalizedTitle: 'akira',
        mediaType: 'movie',
        genres: ['Anime'],
        description: 'Mock',
      },
      custom.list.id,
    )

    expect(saved.entry.activity.status).toBe(custom.list.id)

    const removed = await repository.removeList(custom.list.id)
    const updated = removed.snapshot.activity.find(
      (entry) => entry.catalogId === saved.entry.catalog.id,
    )

    expect(removed.snapshot.lists.some((list) => list.id === custom.list.id)).toBe(false)
    expect(updated?.status).toBe('library')
  })

  it('renames and clears a custom list', async () => {
    const repository = new WatchLogRepository(
      new MemoryStorageProvider(),
      new MockMetadataProvider(),
    )

    const custom = await repository.addList('Weekend')
    await repository.addFromMetadata(
      {
        id: 'ghost-in-the-shell',
        title: 'Ghost in the Shell',
        normalizedTitle: 'ghost in the shell',
        mediaType: 'movie',
        genres: ['Anime'],
        description: 'Mock',
      },
      custom.list.id,
    )

    const renamed = await repository.updateList(custom.list.id, 'Weekend Archive')
    const cleared = await repository.clearList(custom.list.id)

    expect(renamed.list.label).toBe('Weekend Archive')
    expect(cleared.snapshot.activity.some((entry) => entry.status === custom.list.id)).toBe(false)
    expect(cleared.snapshot.catalog.some((entry) => entry.id === 'ghost-in-the-shell')).toBe(false)
  })

  it('removes an entry from catalog and activity', async () => {
    const repository = new WatchLogRepository(
      new MemoryStorageProvider(),
      new MockMetadataProvider(),
    )

    const saved = await repository.addFromMetadata(
      {
        id: 'akira',
        title: 'Akira',
        normalizedTitle: 'akira',
        mediaType: 'movie',
        genres: ['Anime'],
        description: 'Mock',
      },
      'library',
    )

    const removed = await repository.removeEntry(saved.entry.catalog.id)

    expect(removed.snapshot.catalog.some((entry) => entry.id === saved.entry.catalog.id)).toBe(false)
    expect(
      removed.snapshot.activity.some((entry) => entry.catalogId === saved.entry.catalog.id),
    ).toBe(false)
  })

  it('hydrates detected episode progress with metadata totals', async () => {
    const repository = new WatchLogRepository(
      new MemoryStorageProvider(),
      new MockMetadataProvider(),
    )

    const response = await repository.saveDetection({
      listId: 'watching',
      metadata: {
        id: 'anilist:500',
        title: 'Dragon Ball',
        normalizedTitle: 'dragon ball',
        mediaType: 'anime',
        genres: ['Adventure'],
        description: 'Mock',
        episodeCount: 153,
      },
      detection: {
        title: 'Dragon Ball',
        normalizedTitle: 'dragon ball',
        mediaType: 'series',
        sourceSite: 'AnimeAV1',
        url: 'https://anime.example/dragon-ball/12',
        favicon: 'https://anime.example/favicon.ico',
        pageTitle: 'Dragon Ball Episodio 12',
        episode: 12,
        progressLabel: 'Ep 12',
        confidence: 0.9,
      },
    })

    expect(response.entry.activity.currentProgress.episodeTotal).toBe(153)
    expect(response.entry.activity.currentProgress.progressText).toBe('Ep 12/153')
    expect(response.entry.activity.lastSource?.progressText).toBe('Ep 12/153')
  })
})
