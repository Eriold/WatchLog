import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getAniListAvailableEpisodeCount,
  mapAniListMediaToMetadataCard,
  sanitizeAniListDescription,
} from '../src/shared/metadata/anilist-mappers'
import { AniListMetadataProvider } from '../src/shared/metadata/anilist-provider'
import { HybridMetadataProvider } from '../src/shared/metadata/hybrid-provider'
import { MockMetadataProvider } from '../src/shared/metadata/mock-provider'

describe('AniList metadata integration', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('maps AniList media into WatchLog metadata cards', () => {
    const card = mapAniListMediaToMetadataCard({
      id: 21,
      type: 'ANIME',
      episodes: 64,
      duration: 24,
      seasonYear: 1998,
      genres: ['Adventure', 'Action'],
      description: '<b>Space</b> &amp; bounty hunters<br>Forever.',
      averageScore: 86,
      title: {
        english: 'Cowboy Bebop',
        romaji: 'Cowboy Bebop',
      },
      coverImage: {
        extraLarge: 'https://img.test/bebop-xl.jpg',
      },
      bannerImage: 'https://img.test/bebop-banner.jpg',
    })

    expect(card.id).toBe('anilist:21')
    expect(card.title).toBe('Cowboy Bebop')
    expect(card.mediaType).toBe('anime')
    expect(card.episodeCount).toBe(64)
    expect(card.runtime).toBe(24)
    expect(card.poster).toBe('https://img.test/bebop-xl.jpg')
    expect(card.backdrop).toBe('https://img.test/bebop-banner.jpg')
    expect(card.score).toBe(8.6)
    expect(card.description).toContain('Space & bounty hunters')
  })

  it('searches AniList for anime and manga and merges with local mock results', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              Page: {
                media: [
                  {
                    id: 100,
                    type: 'ANIME',
                    episodes: 24,
                    genres: ['Fantasy'],
                    description: 'Dungeon crawl',
                    averageScore: 82,
                    title: { english: 'Dungeon Meshi', romaji: 'Dungeon Meshi' },
                    coverImage: { large: 'https://img.test/dungeon.jpg' },
                    bannerImage: null,
                  },
                ],
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              Page: {
                media: [],
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )

    const provider = new HybridMetadataProvider(
      new MockMetadataProvider(),
      new AniListMetadataProvider(),
    )

    const results = await provider.search('Dungeon Meshi')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(results.some((item) => item.id === 'anilist:100')).toBe(true)
    expect(results.find((item) => item.id === 'anilist:100')?.mediaType).toBe('anime')
  })

  it('sanitizes AniList descriptions without DOM helpers', () => {
    const description = sanitizeAniListDescription('<p>Hello &amp; goodbye</p><br>World')
    expect(description).toContain('Hello & goodbye')
    expect(description).toContain('World')
  })

  it('uses published episodes for currently airing anime when total is not final yet', () => {
    const publishedCount = getAniListAvailableEpisodeCount({
      id: 200,
      type: 'ANIME',
      status: 'RELEASING',
      episodes: null,
      nextAiringEpisode: {
        episode: 14,
      },
    })

    expect(publishedCount).toBe(13)

    const card = mapAniListMediaToMetadataCard({
      id: 200,
      type: 'ANIME',
      status: 'RELEASING',
      episodes: null,
      nextAiringEpisode: {
        episode: 14,
      },
      title: {
        english: 'Ongoing Show',
      },
      description: 'Mock',
    })

    expect(card.episodeCount).toBe(13)
  })
})
