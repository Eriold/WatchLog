import { describe, expect, it } from 'vitest'
import {
  hydrateDetectionWithMetadata,
  hydrateDetectionWithStoredProgress,
} from '../src/shared/metadata/detection-hydration'
import type { DetectionResult, ProgressState } from '../src/shared/types'

function createDetection(overrides: Partial<DetectionResult> = {}): DetectionResult {
  return {
    title: 'A Gentle Noble’s Vacation Recommendation',
    normalizedTitle: 'a-gentle-nobles-vacation-recommendation',
    mediaType: 'anime',
    sourceSite: 'jkanime.net',
    url: 'https://jkanime.net/a-gentle-nobles-vacation-recommendation/9/',
    favicon: 'https://jkanime.net/favicon.ico',
    pageTitle: 'Episode 9',
    progressLabel: 'Ep 9',
    confidence: 0.8,
    ...overrides,
  }
}

describe('detection hydration', () => {
  it('hydrates progress totals from metadata', () => {
    const detection = createDetection({ episode: 9 })

    const hydrated = hydrateDetectionWithMetadata(detection, {
      id: 'anilist:1',
      title: detection.title,
      normalizedTitle: detection.normalizedTitle,
      mediaType: 'anime',
      episodeCount: 13,
      genres: [],
      description: '',
    })

    expect(hydrated.episodeTotal).toBe(13)
    expect(hydrated.progressLabel).toBe('Ep 9/13')
  })

  it('reuses stored progress text when the popup detection only knows the current episode', () => {
    const detection = createDetection({ episode: 9 })
    const storedProgress: ProgressState = {
      episode: 9,
      episodeTotal: 13,
      progressText: '9/13',
    }

    const hydrated = hydrateDetectionWithStoredProgress(detection, storedProgress)

    expect(hydrated.episodeTotal).toBe(13)
    expect(hydrated.progressLabel).toBe('9/13')
  })

  it('keeps the live detected episode and only borrows the stored total when you moved forward', () => {
    const detection = createDetection({ episode: 10, progressLabel: 'Ep 10' })
    const storedProgress: ProgressState = {
      episode: 9,
      episodeTotal: 13,
      progressText: '9/13',
    }

    const hydrated = hydrateDetectionWithStoredProgress(detection, storedProgress)

    expect(hydrated.episode).toBe(10)
    expect(hydrated.episodeTotal).toBe(13)
    expect(hydrated.progressLabel).toBe('Ep 10/13')
  })
})
