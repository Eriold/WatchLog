import { describe, expect, it } from 'vitest'
import {
  buildLibraryUrl,
  parseLibraryNavigationTarget,
} from '../src/shared/navigation'

describe('library navigation helpers', () => {
  it('builds a deep link to a specific library entry', () => {
    const url = buildLibraryUrl('chrome-extension://watchlog/library.html', {
      viewId: 'watching',
      catalogId: 'catalog-42',
    })

    expect(url).toBe(
      'chrome-extension://watchlog/library.html?view=watching&entry=catalog-42',
    )
  })

  it('parses a library deep link from the query string', () => {
    expect(
      parseLibraryNavigationTarget('?view=queue-fantasia&entry=anilist%3A173652'),
    ).toEqual({
      viewId: 'queue-fantasia',
      catalogId: 'anilist:173652',
    })
  })
})
