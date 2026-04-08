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
        publicationStatus: 'RELEASING',
        startDate: {
          year: 1999,
          month: 10,
          day: 20,
        },
        episodeCount: 1122,
        score: 8.8,
      },
      'library',
    )

    expect(response.entry.catalog.id).toBe('anilist:21')
    expect(response.entry.catalog.poster).toBe('https://img.anilist.co/one-piece.jpg')
    expect(response.entry.catalog.backdrop).toBe('https://img.anilist.co/one-piece-banner.jpg')
    expect(response.entry.catalog.description).toBe('Real AniList metadata')
    expect(response.entry.catalog.publicationStatus).toBe('RELEASING')
    expect(response.entry.catalog.startDate).toEqual({
      year: 1999,
      month: 10,
      day: 20,
    })
    expect(response.entry.catalog.episodeCount).toBe(1122)
    expect(response.entry.catalog.score).toBe(8.8)
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

  it('normalizes completed entries to total over total when the total is known', async () => {
    const repository = new WatchLogRepository(
      new MemoryStorageProvider(),
      new MockMetadataProvider(),
    )

    const saved = await repository.addFromMetadata(
      {
        id: 'anilist:777',
        title: "A Gentle Noble's Vacation Recommendation",
        normalizedTitle: 'a gentle nobles vacation recommendation',
        mediaType: 'anime',
        genres: ['Fantasy'],
        description: 'Mock',
        episodeCount: 13,
      },
      'watching',
    )

    const updated = await repository.updateEntry({
      catalogId: saved.entry.catalog.id,
      listId: 'completed',
      progress: {
        episode: 9,
        episodeTotal: 13,
        progressText: '9/13',
      },
    })

    expect(updated.entry?.activity.status).toBe('completed')
    expect(updated.entry?.activity.currentProgress.episode).toBe(13)
    expect(updated.entry?.activity.currentProgress.episodeTotal).toBe(13)
    expect(updated.entry?.activity.currentProgress.progressText).toBe('13/13')
  })

  it('treats the first implicit season as season one so later seasons stay separate', async () => {
    const repository = new WatchLogRepository(
      new MemoryStorageProvider(),
      new MockMetadataProvider(),
    )

    await repository.saveDetection({
      listId: 'watching',
      detection: {
        title: 'KonoSuba',
        normalizedTitle: 'konosuba',
        mediaType: 'anime',
        sourceSite: 'AnimeSite',
        url: 'https://anime.example/konosuba/s1/1',
        favicon: 'https://anime.example/favicon.ico',
        pageTitle: 'KonoSuba Episode 1',
        episode: 1,
        progressLabel: 'Ep 1/10',
        confidence: 0.9,
      },
    })

    const response = await repository.saveDetection({
      listId: 'watching',
      detection: {
        title: 'KonoSuba',
        normalizedTitle: 'konosuba',
        mediaType: 'anime',
        sourceSite: 'AnimeSite',
        url: 'https://anime.example/konosuba/s2/1',
        favicon: 'https://anime.example/favicon.ico',
        pageTitle: 'KonoSuba Season 2 Episode 1',
        season: 2,
        episode: 1,
        progressLabel: 'S2 1/10',
        confidence: 0.9,
      },
    })

    expect(response.snapshot.catalog).toHaveLength(2)
    expect(response.snapshot.activity).toHaveLength(2)
    expect(response.snapshot.catalog.map((item) => item.seasonNumber).sort()).toEqual([1, 2])
  })

  it('merges explorer metadata into an existing alias-matched entry and promotes the English title', async () => {
    const repository = new WatchLogRepository(
      new MemoryStorageProvider(),
      new MockMetadataProvider(),
    )

    await repository.saveDetection({
      listId: 'watching',
      detection: {
        title: 'Odayaka Kizoku no Kyuuka no Susume',
        normalizedTitle: 'odayaka kizoku no kyuuka no susume',
        mediaType: 'anime',
        sourceSite: 'JKAnime',
        url: 'https://jkanime.net/odayaka-kizoku-no-kyuuka-no-susume/1/',
        favicon: 'https://jkanime.net/favicon.ico',
        pageTitle: 'Episodio 1 - Odayaka Kizoku no Kyuuka no Susume',
        episode: 1,
        progressLabel: 'Ep 1',
        confidence: 0.84,
      },
    })

    const response = await repository.addFromMetadata(
      {
        id: 'anilist:999',
        title: "A Gentle Noble's Vacation Recommendation",
        normalizedTitle: 'a gentle nobles vacation recommendation',
        aliases: ['Odayaka Kizoku no Kyuuka no Susume', '穏やか貴族の休暇のすすめ。'],
        mediaType: 'anime',
        poster: 'https://img.anilist.co/gentle-noble.jpg',
        genres: ['Fantasy'],
        description: 'Mock',
        episodeCount: 12,
      },
      'library',
    )

    expect(response.snapshot.catalog).toHaveLength(1)
    expect(response.snapshot.activity).toHaveLength(1)
    expect(response.entry.catalog.title).toBe("A Gentle Noble's Vacation Recommendation")
    expect(response.entry.catalog.aliases).toContain('Odayaka Kizoku no Kyuuka no Susume')
    expect(response.entry.catalog.externalIds.anilist).toBe('999')
    expect(response.entry.activity.status).toBe('library')
    expect(response.entry.activity.currentProgress.episodeTotal).toBe(12)
  })

  it('does not merge a new anime into an unrelated stored entry that only shares a polluted alias', async () => {
    const storage = new MemoryStorageProvider()
    await storage.saveSnapshot({
      catalog: [
        {
          id: 'konosuba-2',
          title: "KONOSUBA -God's blessing on this wonderful world! 2",
          normalizedTitle: 'konosuba gods blessing on this wonderful world 2',
          aliases: ['Isekai Nonbiri Nouka 2'],
          seasonNumber: 2,
          mediaType: 'anime',
          genres: ['Fantasy'],
          externalIds: {},
          createdAt: '2026-04-07T00:00:00.000Z',
          updatedAt: '2026-04-07T00:00:00.000Z',
        },
      ],
      activity: [
        {
          catalogId: 'konosuba-2',
          status: 'watching',
          favorite: false,
          currentProgress: {
            season: 2,
            episode: 1,
            progressText: 'S2 1/10',
          },
          sourceHistory: [],
          manualNotes: '',
          tags: [],
          createdAt: '2026-04-07T00:00:00.000Z',
          updatedAt: '2026-04-07T00:00:00.000Z',
        },
      ],
      lists: [
        { id: 'library', label: 'Library', kind: 'system' },
        { id: 'watching', label: 'Viendo', kind: 'system' },
        { id: 'completed', label: 'Finalizado', kind: 'system' },
      ],
    })

    const repository = new WatchLogRepository(storage, new MockMetadataProvider())

    const response = await repository.saveDetection({
      listId: 'watching',
      metadata: {
        id: 'anilist:197824',
        title: 'Farming Life in Another World 2',
        normalizedTitle: 'farming life in another world 2',
        aliases: ['Isekai Nonbiri Nouka 2', '異世界のんびり農家２'],
        mediaType: 'anime',
        genres: ['Fantasy'],
        description: 'Mock',
        episodeCount: 12,
      },
      detection: {
        title: 'Isekai Nonbiri Nouka 2',
        normalizedTitle: 'isekai nonbiri nouka 2',
        mediaType: 'anime',
        sourceSite: 'animeav1.com',
        url: 'https://animeav1.com/media/isekai-nonbiri-nouka-2/1',
        favicon: 'https://animeav1.com/favicon.ico',
        pageTitle: 'Isekai Nonbiri Nouka 2 Episodio 1',
        episode: 1,
        progressLabel: 'Ep 1',
        confidence: 0.84,
      },
    })

    expect(response.snapshot.catalog).toHaveLength(2)
    expect(response.snapshot.activity).toHaveLength(2)
    expect(response.entry.catalog.id).toBe('anilist:197824')
    expect(response.entry.catalog.title).toBe('Farming Life in Another World 2')
  })
})
