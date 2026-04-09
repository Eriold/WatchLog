import { describe, expect, it } from 'vitest'
import { mapAniListMediaToMetadataCard } from '../src/shared/metadata/anilist-mappers'
import { getDetectionMediaTypeHints, pickBestMetadataMatch } from '../src/shared/metadata/matching'
import { normalizeTitle } from '../src/shared/utils/normalize'
import type { MetadataCard } from '../src/shared/types'

describe('metadata matching', () => {
  it('keeps AniList novels out of manga matches when format is NOVEL', () => {
    const card = mapAniListMediaToMetadataCard({
      id: 110802,
      type: 'MANGA',
      format: 'NOVEL',
      title: {
        romaji:
          'Honzuki no Gekokujou: Shisho ni Naru Tame ni wa Shudan wo Erandeiraremasen Dai 4-bu - Kizoku-in no Jishou Tosho Iin',
        english: 'Ascendance of a Bookworm: Part 4',
      },
      description: 'Mock novel payload',
    })

    expect(card.mediaType).toBe('novel')
  })

  it('matches long MangaDex-style romanized titles against AniList manga entries', () => {
    const items: MetadataCard[] = [
      {
        id: 'anilist:110802',
        title:
          'Honzuki no Gekokujou: Shisho ni Naru Tame ni wa Shudan wo Erandeiraremasen Dai 4-bu - Kizoku-in no Jishou Tosho Iin',
        normalizedTitle: normalizeTitle(
          'Honzuki no Gekokujou: Shisho ni Naru Tame ni wa Shudan wo Erandeiraremasen Dai 4-bu - Kizoku-in no Jishou Tosho Iin',
        ),
        aliases: ['Ascendance of a Bookworm: Part 4'],
        seasonNumber: 4,
        mediaType: 'novel',
        genres: [],
        description: 'Novel entry',
      },
      {
        id: 'anilist:127249',
        title:
          'Honzuki no Gekokujou: Shisho ni Naru Tame ni wa Shudan wo Erandeiraremasen Dai 4-bu - Kizoku-in no Toshokan wo Sukuitai!',
        normalizedTitle: normalizeTitle(
          'Honzuki no Gekokujou: Shisho ni Naru Tame ni wa Shudan wo Erandeiraremasen Dai 4-bu - Kizoku-in no Toshokan wo Sukuitai!',
        ),
        aliases: [
          "Ascendance of a Bookworm ~I'll do anything to become a librarian!~ Part 4 I want to save the Royal Academy's library!",
        ],
        seasonNumber: 4,
        mediaType: 'manga',
        genres: [],
        description: 'Manga entry',
      },
    ]

    const match = pickBestMetadataMatch(
      items,
      'Honzuki no Gekokujou: Shisho ni Naru tame ni wa Shudan o Erandeiraremasen—Dai-4 Bu: Kizokuin no Toshokan o Sukuitai!',
      ['manga'],
      4,
    )

    expect(match?.id).toBe('anilist:127249')
  })

  it('treats Shadow Manga hosts as manga hints even if the provisional media type is wrong', () => {
    const hints = getDetectionMediaTypeHints({
      mediaType: 'movie',
      sourceSite: 'shadowmanga.es',
      url: 'https://www.shadowmanga.es/serie/local/52432',
    })

    expect(hints[0]).toBe('manga')
    expect(hints).toContain('movie')
  })
})
