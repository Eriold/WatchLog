import { describe, expect, it } from 'vitest'
import {
  buildProgressStateFromControl,
  getResolvedProgressState,
  getStructuredProgressControl,
  isDetectionAlreadyTracked,
} from '../src/shared/progress'

describe('getResolvedProgressState', () => {
  it('forces completed episodic entries to total over total', () => {
    expect(
      getResolvedProgressState(
        {
          episode: 9,
          episodeTotal: 13,
          progressText: '9/13',
        },
        'completed',
      ),
    ).toEqual({
      episode: 13,
      episodeTotal: 13,
      progressText: '13/13',
    })
  })

  it('uses catalog totals when a completed entry does not store them yet', () => {
    expect(
      getResolvedProgressState(
        {
          episode: 9,
          progressText: '9/13',
        },
        'completed',
        {
          episodeCount: 13,
        },
      ),
    ).toEqual({
      episode: 13,
      episodeTotal: 13,
      progressText: '13/13',
    })
  })

  it('builds structured episodic progress from the selected value', () => {
    const control = getStructuredProgressControl({
      season: 1,
      episode: 3,
      episodeTotal: 10,
      progressText: '3/10',
    })

    expect(control).not.toBeNull()
    expect(
      buildProgressStateFromControl(
        {
          season: 1,
          episode: 3,
          episodeTotal: 10,
          progressText: '3/10',
        },
        'watching',
        control!,
        6,
      ),
    ).toEqual({
      season: 1,
      episode: 6,
      episodeTotal: 10,
      progressText: '6/10',
    })
  })

  it('forces structured progress to total over total in completed lists', () => {
    const control = getStructuredProgressControl({
      episode: 6,
      episodeTotal: 10,
      progressText: '6/10',
    })

    expect(control).not.toBeNull()
    expect(
      buildProgressStateFromControl(
        {
          episode: 6,
          episodeTotal: 10,
          progressText: '6/10',
        },
        'completed',
        control!,
        6,
      ),
    ).toEqual({
      episode: 10,
      episodeTotal: 10,
      chapter: undefined,
      chapterTotal: undefined,
      progressText: '10/10',
    })
  })

  it('treats a detected episode as already tracked when the stored progress is ahead', () => {
    expect(
      isDetectionAlreadyTracked(
        {
          season: 1,
          episode: 5,
          episodeTotal: 12,
          progressText: '5/12',
        },
        'watching',
        {
          season: 1,
          episode: 4,
          chapter: undefined,
        },
        {
          episodeCount: 12,
        },
      ),
    ).toBe(true)
  })

  it('keeps a later detected episode pending until it is actually saved', () => {
    expect(
      isDetectionAlreadyTracked(
        {
          season: 1,
          episode: 5,
          episodeTotal: 12,
          progressText: '5/12',
        },
        'watching',
        {
          season: 1,
          episode: 6,
          chapter: undefined,
        },
        {
          episodeCount: 12,
        },
      ),
    ).toBe(false)
  })
})
