import { afterEach, describe, expect, it, vi } from 'vitest'
import { MangaDexMetadataProvider } from '../src/shared/metadata/mangadex-provider'

describe('MangaDexMetadataProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('maps MangaDex search results into metadata cards with source links and scores', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)

      if (url.includes('/statistics/manga/md-1')) {
        return new Response(
          JSON.stringify({
            statistics: {
              'md-1': {
                rating: {
                  average: 8.4,
                  bayesian: 8.7,
                },
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      if (url.includes('/manga?')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: 'md-1',
                type: 'manga',
                attributes: {
                  title: {
                    en: 'Pokémon Adventures',
                  },
                  altTitles: [
                    {
                      ja: 'ポケットモンスター SPECIAL',
                    },
                  ],
                  description: {
                    en: 'Mock MangaDex description',
                  },
                  originalLanguage: 'ja',
                  status: 'ongoing',
                  year: 1997,
                  lastChapter: '67',
                },
                relationships: [
                  {
                    id: 'cover-1',
                    type: 'cover_art',
                    attributes: {
                      fileName: 'cover-file.jpg',
                    },
                  },
                ],
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      throw new Error(`Unexpected request: ${url}`)
    })

    const provider = new MangaDexMetadataProvider()
    const results = await provider.search('Pokémon')

    expect(results).toHaveLength(1)
    expect(results[0]?.id).toBe('mangadex:md-1')
    expect(results[0]?.title).toBe('Pokémon Adventures')
    expect(results[0]?.sourceUrl).toBe('https://mangadex.org/title/md-1')
    expect(results[0]?.poster).toBe('https://uploads.mangadex.org/covers/md-1/cover-file.jpg.512.jpg')
    expect(results[0]?.score).toBe(8.7)
    expect(results[0]?.mediaType).toBe('manga')
  })
})
