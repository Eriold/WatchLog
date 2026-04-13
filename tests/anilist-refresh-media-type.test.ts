import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/shared/metadata/title-translation', () => ({
  getTranslatedTitleCandidates: vi.fn(async (title: string) => [title, 'Mountain Sect']),
}))

import { refreshAniListMetadata } from '../src/shared/client'
import { normalizeTitle } from '../src/shared/utils/normalize'
import type { DetectionResult } from '../src/shared/types'
import { getTranslatedTitleCandidates } from '../src/shared/metadata/title-translation'

function createDetection(mediaType: DetectionResult['mediaType']): DetectionResult {
  return {
    title: 'Secta de la montaña',
    normalizedTitle: normalizeTitle('Secta de la montaña'),
    mediaType,
    sourceSite: 'olympusbiblioteca.com',
    url: 'https://olympusbiblioteca.com/perfil',
    favicon: 'https://olympusbiblioteca.com/favicon.ico',
    pageTitle: 'Perfil | Olympus Biblioteca',
    progressLabel: 'Sin progreso',
    confidence: 0.8,
  }
}

describe('refreshAniListMetadata', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('queries AniList only as manga-like media when the entry is manga', async () => {
    const requests: Array<{ search: string; type: string }> = []

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      const payload = JSON.parse(String(init?.body ?? '{}')) as {
        variables?: { search?: string; type?: string }
      }
      requests.push({
        search: payload.variables?.search ?? '',
        type: payload.variables?.type ?? '',
      })

      return new Response(
        JSON.stringify({
          data: {
            Page: {
              media:
                payload.variables?.search === 'Mountain Sect' && payload.variables?.type === 'MANGA'
                  ? [
                      {
                        id: 9002,
                        type: 'MANGA',
                        format: 'MANGA',
                        status: 'RELEASING',
                        chapters: 40,
                        title: {
                          romaji: 'Yama no Secta',
                          english: 'Mountain Sect',
                          native: '山の教団',
                        },
                        description: 'Mock AniList metadata',
                        genres: ['Fantasy'],
                        coverImage: {
                          large: 'https://img.test/mountain-sect.jpg',
                        },
                      },
                    ]
                  : [],
            },
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    })

    const metadata = await refreshAniListMetadata(createDetection('manga'))

    expect(requests[0]).toMatchObject({ search: 'Secta de la montaña', type: 'MANGA' })
    expect(requests.some((request) => request.search === 'Mountain Sect')).toBe(true)
    expect(requests.every((request) => request.type === 'MANGA')).toBe(true)
    expect(metadata?.id).toBe('anilist:9002')
    expect(metadata?.title).toBe('Mountain Sect')
  })

  it('queries AniList only as anime when the entry is anime', async () => {
    const requests: Array<{ search: string; type: string }> = []

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      const payload = JSON.parse(String(init?.body ?? '{}')) as {
        variables?: { search?: string; type?: string }
      }
      requests.push({
        search: payload.variables?.search ?? '',
        type: payload.variables?.type ?? '',
      })

      return new Response(
        JSON.stringify({
          data: {
            Page: {
              media:
                payload.variables?.search === 'Mountain Sect' && payload.variables?.type === 'ANIME'
                  ? [
                      {
                        id: 7002,
                        type: 'ANIME',
                        format: 'TV',
                        status: 'RELEASING',
                        episodes: 12,
                        title: {
                          romaji: 'Yama no Secta',
                          english: 'Mountain Sect',
                          native: '山の教団',
                        },
                        description: 'Mock AniList metadata',
                        genres: ['Fantasy'],
                        coverImage: {
                          large: 'https://img.test/mountain-sect-anime.jpg',
                        },
                      },
                    ]
                  : [],
            },
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    })

    const metadata = await refreshAniListMetadata(createDetection('anime'))

    expect(requests[0]).toMatchObject({ search: 'Secta de la montaña', type: 'ANIME' })
    expect(requests.some((request) => request.search === 'Mountain Sect')).toBe(true)
    expect(requests.every((request) => request.type === 'ANIME')).toBe(true)
    expect(metadata?.id).toBe('anilist:7002')
    expect(metadata?.title).toBe('Mountain Sect')
  })

  it('falls back to the top AniList-ranked translated result when local title matching rejects all items', async () => {
    vi.mocked(getTranslatedTitleCandidates).mockResolvedValueOnce([
      'Secta de la montaña',
      'Blossoming Blade Sect',
    ])

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      const payload = JSON.parse(String(init?.body ?? '{}')) as {
        variables?: { search?: string; type?: string }
      }

      const media =
        payload.variables?.search === 'Blossoming Blade Sect' &&
        payload.variables?.type === 'MANGA'
          ? [
              {
                id: 132144,
                type: 'MANGA',
                format: 'MANGA',
                status: 'RELEASING',
                chapters: 120,
                title: {
                  romaji: 'Hwasangwihwan',
                  english: 'Return of the Blossoming Blade',
                  native: '화산귀환',
                },
                description: 'Mock AniList metadata',
                genres: ['Action', 'Adventure', 'Fantasy'],
                coverImage: {
                  large: 'https://img.test/blossoming-blade.jpg',
                },
              },
              {
                id: 142162,
                type: 'MANGA',
                format: 'MANGA',
                status: 'RELEASING',
                chapters: 40,
                title: {
                  romaji: 'Isekai ni Teni shitara Yama no Naka datta.',
                  english: null,
                  native: '異世界に転移したら山の中だった。',
                },
                description: 'Secondary result',
                genres: ['Fantasy'],
                coverImage: {
                  large: 'https://img.test/isekai-mountain.jpg',
                },
              },
            ]
          : []

      return new Response(
        JSON.stringify({
          data: {
            Page: {
              media,
            },
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    })

    const metadata = await refreshAniListMetadata(createDetection('manga'))

    expect(metadata?.id).toBe('anilist:132144')
    expect(metadata?.title).toBe('Return of the Blossoming Blade')
  })

  it('bypasses AniList search cache on manual refresh so repeated attempts still hit the API', async () => {
    const requests: Array<{ search: string; type: string }> = []

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      const payload = JSON.parse(String(init?.body ?? '{}')) as {
        variables?: { search?: string; type?: string }
      }
      requests.push({
        search: payload.variables?.search ?? '',
        type: payload.variables?.type ?? '',
      })

      return new Response(
        JSON.stringify({
          data: {
            Page: {
              media: [],
            },
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    })

    const detection = createDetection('manga')

    await refreshAniListMetadata(detection)
    await refreshAniListMetadata(detection)

    expect(
      requests.filter(
        (request) => request.search === detection.title && request.type === 'MANGA',
      ),
    ).toHaveLength(2)
    expect(
      requests.filter(
        (request) => request.search === 'Mountain Sect' && request.type === 'MANGA',
      ),
    ).toHaveLength(2)
  })
})
