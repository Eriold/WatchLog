import { describe, expect, it } from 'vitest'
import {
  findMatchingLibraryEntry,
  findMatchingLibraryEntryForMetadata,
} from '../src/shared/selectors'
import type { DetectionResult, MetadataCard, WatchLogSnapshot } from '../src/shared/types'

function createSnapshot(): WatchLogSnapshot {
  return {
    catalog: [],
    activity: [],
    lists: [
      { id: 'library', label: 'Library', kind: 'system' },
      { id: 'watching', label: 'Watching', kind: 'system' },
      { id: 'completed', label: 'Completed', kind: 'system' },
    ],
  }
}

function createDetection(overrides: Partial<DetectionResult>): DetectionResult {
  return {
    title: 'One Piece',
    normalizedTitle: 'one piece',
    mediaType: 'anime',
    sourceSite: 'animeav1.com',
    url: 'https://animeav1.com/media/one-piece/1',
    favicon: 'https://animeav1.com/favicon.ico',
    pageTitle: 'One Piece Episodio 1',
    episode: 1,
    progressLabel: 'Ep 1',
    confidence: 0.8,
    ...overrides,
  }
}

describe('library matching selectors', () => {
  it('matches direct popup detections only against the catalog primary title', () => {
    const snapshot = createSnapshot()
    snapshot.catalog.push({
      id: 'anilist:21',
      title: 'One Piece',
      normalizedTitle: 'one piece',
      mediaType: 'anime',
      genres: [],
      externalIds: { anilist: '21' },
      createdAt: '2026-04-07T00:00:00.000Z',
      updatedAt: '2026-04-07T00:00:00.000Z',
    })
    snapshot.activity.push({
      catalogId: 'anilist:21',
      status: 'watching',
      favorite: false,
      currentProgress: {
        episode: 1,
        progressText: 'Ep 1',
      },
      sourceHistory: [],
      manualNotes: '',
      tags: [],
      createdAt: '2026-04-07T00:00:00.000Z',
      updatedAt: '2026-04-07T00:00:00.000Z',
    })

    const match = findMatchingLibraryEntry(snapshot, createDetection({}))

    expect(match?.catalog.id).toBe('anilist:21')
  })

  it('does not auto-match a different entry only because a polluted alias overlaps', () => {
    const snapshot = createSnapshot()
    snapshot.catalog.push({
      id: 'konosuba-2',
      title: "KONOSUBA -God's blessing on this wonderful world! 2",
      normalizedTitle: 'konosuba gods blessing on this wonderful world 2',
      aliases: ['Isekai Nonbiri Nouka 2'],
      seasonNumber: 2,
      mediaType: 'anime',
      genres: [],
      externalIds: {},
      createdAt: '2026-04-07T00:00:00.000Z',
      updatedAt: '2026-04-07T00:00:00.000Z',
    })
    snapshot.activity.push({
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
    })

    const detection = createDetection({
      title: 'Isekai Nonbiri Nouka 2',
      normalizedTitle: 'isekai nonbiri nouka 2',
      url: 'https://animeav1.com/media/isekai-nonbiri-nouka-2/1',
      pageTitle: 'Isekai Nonbiri Nouka 2 Episodio 1',
    })

    expect(findMatchingLibraryEntry(snapshot, detection)).toBeNull()
  })

  it('still matches a stored alternate-title entry when metadata includes the saved primary title', () => {
    const snapshot = createSnapshot()
    snapshot.catalog.push({
      id: 'catalog-gentle-noble',
      title: 'Odayaka Kizoku no Kyuuka no Susume',
      normalizedTitle: 'odayaka kizoku no kyuuka no susume',
      mediaType: 'anime',
      genres: [],
      externalIds: {},
      createdAt: '2026-04-07T00:00:00.000Z',
      updatedAt: '2026-04-07T00:00:00.000Z',
    })
    snapshot.activity.push({
      catalogId: 'catalog-gentle-noble',
      status: 'watching',
      favorite: false,
      currentProgress: {
        episode: 1,
        progressText: 'Ep 1',
      },
      sourceHistory: [],
      manualNotes: '',
      tags: [],
      createdAt: '2026-04-07T00:00:00.000Z',
      updatedAt: '2026-04-07T00:00:00.000Z',
    })

    const metadata: MetadataCard = {
      id: 'anilist:999',
      title: "A Gentle Noble's Vacation Recommendation",
      normalizedTitle: 'a gentle nobles vacation recommendation',
      aliases: ['Odayaka Kizoku no Kyuuka no Susume'],
      mediaType: 'anime',
      genres: ['Fantasy'],
      description: 'Mock',
      episodeCount: 12,
    }

    const match = findMatchingLibraryEntryForMetadata(snapshot, metadata)

    expect(match?.catalog.id).toBe('catalog-gentle-noble')
  })
})
