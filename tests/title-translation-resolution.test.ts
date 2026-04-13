import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/shared/metadata/title-translation', () => ({
  getTranslatedTitleCandidates: vi.fn(async (title: string) => [title, 'Mountain Sect']),
}))

import { resolveDetectionMetadata } from '../src/shared/client'
import { normalizeTitle } from '../src/shared/utils/normalize'
import type { DetectionResult } from '../src/shared/types'
import { getTranslatedTitleCandidates } from '../src/shared/metadata/title-translation'

function createDetection(overrides: Partial<DetectionResult> = {}): DetectionResult {
  return {
    title: 'Secta de la montaña',
    normalizedTitle: normalizeTitle('Secta de la montaña'),
    mediaType: 'manga',
    sourceSite: 'olympusbiblioteca.com',
    url: 'https://olympusbiblioteca.com/perfil',
    favicon: 'https://olympusbiblioteca.com/favicon.ico',
    pageTitle: 'Perfil | Olympus Biblioteca',
    progressLabel: 'Sin progreso',
    confidence: 0.8,
    ...overrides,
  }
}

describe('resolveDetectionMetadata title translation', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('searches AniList with translated title candidates when the original Spanish title does not match', async () => {
    const requestedSearches: string[] = []

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      const payload = JSON.parse(String(init?.body ?? '{}')) as {
        variables?: { search?: string }
      }
      const search = payload.variables?.search ?? ''
      requestedSearches.push(search)

      const media =
        search === 'Mountain Sect'
          ? [
              {
                id: 9001,
                type: 'MANGA',
                format: 'MANGA',
                status: 'RELEASING',
                chapters: 33,
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

    const metadata = await resolveDetectionMetadata(createDetection())

    expect(getTranslatedTitleCandidates).toHaveBeenCalledWith('Secta de la montaña')
    expect(requestedSearches[0]).toBe('Mountain Sect')
    expect(metadata?.id).toBe('anilist:9001')
    expect(metadata?.title).toBe('Mountain Sect')
  })
})
