import { describe, expect, it } from 'vitest'
import { pickBestMetadataMatch } from '../src/shared/metadata/matching'
import {
  getDetectionSeasonNumber,
  getMetadataSeasonNumber,
  inferSeasonNumberFromTitles,
} from '../src/shared/season'
import type { MetadataCard } from '../src/shared/types'

describe('season-aware metadata matching', () => {
  it('infers season numbers from sequel titles', () => {
    expect(inferSeasonNumberFromTitles(['KONOSUBA 2'])).toBe(2)
    expect(inferSeasonNumberFromTitles(['KONOSUBA 3'])).toBe(3)
    expect(inferSeasonNumberFromTitles(['KONOSUBA 2nd Season'])).toBe(2)
  })

  it('defaults episodic anime without an explicit sequel marker to season one', () => {
    expect(
      getMetadataSeasonNumber({
        title: "KONOSUBA -God's blessing on this wonderful world!",
        mediaType: 'anime',
        episodeCount: 10,
      }),
    ).toBe(1)

    expect(
      getDetectionSeasonNumber({
        title: 'KONOSUBA',
        mediaType: 'anime',
        episode: 1,
      }),
    ).toBe(1)
  })

  it('prefers the metadata card for the requested season', () => {
    const items: MetadataCard[] = [
      {
        id: 'anilist:1',
        title: "KONOSUBA -God's blessing on this wonderful world!",
        normalizedTitle: 'konosuba gods blessing on this wonderful world',
        mediaType: 'anime',
        genres: [],
        description: '',
      },
      {
        id: 'anilist:2',
        title: "KONOSUBA -God's blessing on this wonderful world! 2",
        normalizedTitle: 'konosuba gods blessing on this wonderful world 2',
        seasonNumber: 2,
        mediaType: 'anime',
        genres: [],
        description: '',
      },
    ]

    expect(pickBestMetadataMatch(items, 'KONOSUBA', ['anime'], 2)?.id).toBe('anilist:2')
  })
})
