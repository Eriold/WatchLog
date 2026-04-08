import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveDetectionMetadata } from '../src/shared/client'
import { normalizeTitle } from '../src/shared/utils/normalize'
import type { DetectionResult } from '../src/shared/types'

function createDetection(overrides: Partial<DetectionResult> = {}): DetectionResult {
  return {
    title:
      'Honzuki no Gekokujou: Shisho ni Naru tame ni wa Shudan o Erandeiraremasen—Dai-4 Bu: Kizokuin no Toshokan o Sukuitai!',
    normalizedTitle: normalizeTitle(
      'Honzuki no Gekokujou: Shisho ni Naru tame ni wa Shudan o Erandeiraremasen—Dai-4 Bu: Kizokuin no Toshokan o Sukuitai!',
    ),
    mediaType: 'manga',
    sourceSite: 'mangadex.org',
    url: 'https://mangadex.org/chapter/example',
    favicon: 'https://mangadex.org/favicon.ico',
    pageTitle:
      'Honzuki no Gekokujou: Shisho ni Naru tame ni wa Shudan o Erandeiraremasen—Dai-4 Bu: Kizokuin no Toshokan o Sukuitai! - Ch. 42 - MangaDex',
    chapter: 42,
    progressLabel: 'Cap 42',
    confidence: 0.8,
    ...overrides,
  }
}

describe('resolveDetectionMetadata', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('falls back to normalized title resolution when the raw popup query does not recover AniList metadata', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      const payload = JSON.parse(String(init?.body ?? '{}')) as {
        variables?: { search?: string }
      }
      const search = payload.variables?.search ?? ''

      const titleSearch =
        'Honzuki no Gekokujou: Shisho ni Naru tame ni wa Shudan o Erandeiraremasen—Dai-4 Bu: Kizokuin no Toshokan o Sukuitai!'
      const normalizedSearch = normalizeTitle(titleSearch)

      const media =
        search === normalizedSearch
          ? [
              {
                id: 127249,
                type: 'MANGA',
                format: 'MANGA',
                status: 'RELEASING',
                chapters: null,
                title: {
                  romaji:
                    'Honzuki no Gekokujou: Shisho ni Naru Tame ni wa Shudan wo Erandeiraremasen Dai 4-bu - Kizoku-in no Toshokan wo Sukuitai!',
                  english:
                    "Ascendance of a Bookworm ~I'll do anything to become a librarian!~ Part 4 I want to save the Royal Academy's library!",
                  native:
                    '本好きの下剋上~司書になるためには手段を選んでいられません~ 第四部 「貴族院の図書館を救いたい！」',
                },
                description: 'Mock AniList metadata',
                genres: ['Fantasy'],
                coverImage: {
                  large: 'https://img.test/bookworm-part4.jpg',
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

    expect(metadata?.id).toBe('anilist:127249')
    expect(metadata?.poster).toBe('https://img.test/bookworm-part4.jpg')
    expect(metadata?.mediaType).toBe('manga')
  })
})
