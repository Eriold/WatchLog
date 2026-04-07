import { describe, expect, it } from 'vitest'
import { getResolvedProgressState } from '../src/shared/progress'

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
})
