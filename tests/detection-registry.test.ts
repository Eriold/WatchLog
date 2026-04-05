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

  it('prioritizes the first h1 over later title candidates', () => {
    const fixture = `
      <!doctype html>
      <html lang="en">
        <head>
          <title>Fallback Window Title - YouTube</title>
        </head>
        <body>
          <main>
            <h1>Correct Video Title</h1>
            <yt-formatted-string class="style-scope ytd-watch-metadata">
              Wrong Candidate Title
            </yt-formatted-string>
            <h1>Second Heading</h1>
          </main>
        </body>
      </html>
    `

    const result = detectCurrentDocument(
      parseFixture(fixture),
      'https://www.youtube.com/watch?v=phase1',
    )

    expect(result?.title).toBe('Correct Video Title')
    expect(result?.sourceSite).toBe('YouTube')
  })

  it('falls back to og:title when YouTube has no usable h1 yet', () => {
    const fixture = `
      <!doctype html>
      <html lang="es">
        <head>
          <title>YouTube</title>
          <meta property="og:title" content="ELIMINAMOS cámara de FOTOMULTA y ¿sabías que esto es lo que debes hacer?" />
        </head>
        <body>
          <main>
            <div>Loading player...</div>
          </main>
        </body>
      </html>
    `

    const result = detectCurrentDocument(
      parseFixture(fixture),
      'https://www.youtube.com/watch?app=desktop&v=Tj4s78WcLxw',
    )

    expect(result?.title).toBe(
      'ELIMINAMOS cámara de FOTOMULTA y ¿sabías que esto es lo que debes hacer?',
    )
    expect(result?.sourceSite).toBe('YouTube')
    expect(result?.mediaType).toBe('video')
  })

  it('uses YouTube meta name title when the h1 is not mounted yet', () => {
    const fixture = `
      <!doctype html>
      <html lang="es">
        <head>
          <title>YouTube</title>
          <meta name="title" content="ELIMINAMOS cámara de FOTOMULTA y ¿sabías que esto es lo que debes hacer?" />
        </head>
        <body>
          <main>
            <div>Loading player...</div>
          </main>
        </body>
      </html>
    `

    const result = detectCurrentDocument(
      parseFixture(fixture),
      'https://www.youtube.com/watch?app=desktop&v=Tj4s78WcLxw',
    )

    expect(result?.title).toBe(
      'ELIMINAMOS cámara de FOTOMULTA y ¿sabías que esto es lo que debes hacer?',
    )
    expect(result?.sourceSite).toBe('YouTube')
    expect(result?.mediaType).toBe('video')
  })

  it('rejects placeholder YouTube titles while waiting for real metadata', () => {
    const fixture = `
      <!doctype html>
      <html lang="es">
        <head>
          <title>YouTube</title>
        </head>
        <body>
          <main>
            <div>Loading player...</div>
          </main>
        </body>
      </html>
    `

    const result = detectCurrentDocument(
      parseFixture(fixture),
      'https://www.youtube.com/watch?app=desktop&v=Tj4s78WcLxw',
    )

    expect(result).toBeNull()
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
