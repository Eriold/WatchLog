import { describe, expect, it } from 'vitest'
import { detectCurrentDocument } from '../src/shared/detection/registry'
import genericHtml from './fixtures/generic.html?raw'
import maxHtml from './fixtures/max.html?raw'
import netflixHtml from './fixtures/netflix.html?raw'
import primeHtml from './fixtures/prime.html?raw'
import youtubeHtml from './fixtures/youtube.html?raw'

function parseFixture(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

describe('detectCurrentDocument', () => {
  it('extracts series progress from Netflix fixtures', () => {
    const result = detectCurrentDocument(
      parseFixture(netflixHtml),
      'https://www.netflix.com/watch/123',
    )

    expect(result).not.toBeNull()
    expect(result?.sourceSite).toBe('Netflix')
    expect(result?.title).toBe('The Big Bang Theory')
    expect(result?.season).toBe(3)
    expect(result?.episode).toBe(5)
  })

  it('extracts Max titles and progress', () => {
    const result = detectCurrentDocument(parseFixture(maxHtml), 'https://play.max.com/show/arcane')

    expect(result?.sourceSite).toBe('Max')
    expect(result?.title).toBe('Arcane')
    expect(result?.season).toBe(2)
    expect(result?.episode).toBe(3)
  })

  it('treats Prime fixture as a movie', () => {
    const result = detectCurrentDocument(
      parseFixture(primeHtml),
      'https://www.primevideo.com/detail/0ABC',
    )

    expect(result?.sourceSite).toBe('Prime Video')
    expect(result?.title).toBe('The Matrix Reloaded')
    expect(result?.mediaType).toBe('movie')
  })

  it('treats YouTube fixture as video', () => {
    const result = detectCurrentDocument(
      parseFixture(youtubeHtml),
      'https://www.youtube.com/watch?v=abc123',
    )

    expect(result?.sourceSite).toBe('YouTube')
    expect(result?.mediaType).toBe('video')
  })

  it('falls back to the generic adapter for chapter-based pages', () => {
    const result = detectCurrentDocument(
      parseFixture(genericHtml),
      'https://reader.example.com/one-piece/chapter-1080',
    )

    expect(result?.sourceSite).toBe('reader.example.com')
    expect(result?.chapter).toBe(1080)
    expect(result?.progressLabel).toContain('Cap 1080')
  })
})
