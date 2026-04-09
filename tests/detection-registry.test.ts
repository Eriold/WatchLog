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

  it('cleans Shadow Manga SEO titles into the real manga name', () => {
    const fixture = `
      <!doctype html>
      <html lang="es">
        <head>
          <title>Leer One Piece manga online en español | Shadow Manga</title>
          <meta property="og:title" content="Leer One Piece manga online en español | Shadow Manga" />
        </head>
        <body>
          <main>
            <p>Monkey D. Luffy quiere convertirse en el Rey de los Piratas.</p>
          </main>
        </body>
      </html>
    `

    const result = detectCurrentDocument(
      parseFixture(fixture),
      'https://www.shadowmanga.es/serie/local/52432',
    )

    expect(result?.sourceSite).toBe('shadowmanga.es')
    expect(result?.title).toBe('One Piece')
    expect(result?.mediaType).toBe('manga')
  })

  it('rejects generic Shadow Manga reader placeholder titles', () => {
    const fixture = `
      <!doctype html>
      <html lang="es">
        <head>
          <title>Manga online en español | Shadow Manga</title>
          <meta property="og:title" content="Manga online en español | Shadow Manga" />
        </head>
        <body>
          <main>
            <h1>Lee manga online en español</h1>
          </main>
        </body>
      </html>
    `

    const result = detectCurrentDocument(
      parseFixture(fixture),
      'https://www.shadowmanga.es/reader/local/470877',
    )

    expect(result).toBeNull()
  })

  it('detects the hydrated Shadow Manga reader title from the header button', () => {
    const fixture = `
      <!doctype html>
      <html lang="es">
        <head>
          <title>Manga online en espaÃ±ol | Shadow Manga</title>
          <meta property="og:title" content="Manga online en espaÃ±ol | Shadow Manga" />
        </head>
        <body>
          <div class="fixed top-0 left-0 right-0 z-50 bg-black/80">
            <div class="flex items-center px-3 py-2 max-w-4xl mx-auto gap-2">
              <button class="text-xs font-bold text-white hover:text-primary-400 transition-colors truncate leading-tight">
                Honzuki No Gekokujou Part 4
              </button>
            </div>
          </div>
        </body>
      </html>
    `

    const result = detectCurrentDocument(
      parseFixture(fixture),
      'https://www.shadowmanga.es/reader/local/470879',
    )

    expect(result?.sourceSite).toBe('shadowmanga.es')
    expect(result?.title).toBe('Honzuki No Gekokujou Part 4')
    expect(result?.mediaType).toBe('manga')
  })

  it('extracts the anime title when the h1 only contains the episode number', () => {
    const fixture = `
      <!doctype html>
      <html lang="es">
        <head>
          <title>One Piece Episodio 1156 Sub Español Online en HD - AnimeAV1</title>
        </head>
        <body>
          <main>
            <div>Estás viendo</div>
            <h1>Episodio 1156</h1>
            <a href="/media/one-piece">One Piece</a>
          </main>
        </body>
      </html>
    `

    const result = detectCurrentDocument(
      parseFixture(fixture),
      'https://animeav1.com/media/one-piece/1156',
    )

    expect(result?.sourceSite).toBe('animeav1.com')
    expect(result?.title).toBe('One Piece')
    expect(result?.episode).toBe(1156)
    expect(result?.progressLabel).toBe('Ep 1156')
    expect(result?.mediaType).toBe('anime')
  })

  it('keeps sequel numbers from AnimeAV1 titles instead of collapsing them into another show', () => {
    const fixture = `
      <!doctype html>
      <html lang="es">
        <head>
          <title>Isekai Nonbiri Nouka 2 Episodio 1 Sub Español Online en HD - AnimeAV1</title>
        </head>
        <body>
          <main>
            <div>Estás viendo</div>
            <h1>Episodio 1</h1>
            <a href="/media/isekai-nonbiri-nouka-2">Isekai Nonbiri Nouka 2</a>
            <p>Segunda temporada de Isekai Nonbiri Nouka.</p>
          </main>
        </body>
      </html>
    `

    const result = detectCurrentDocument(
      parseFixture(fixture),
      'https://animeav1.com/media/isekai-nonbiri-nouka-2/1',
    )

    expect(result?.sourceSite).toBe('animeav1.com')
    expect(result?.title).toBe('Isekai Nonbiri Nouka 2')
    expect(result?.episode).toBe(1)
    expect(result?.mediaType).toBe('anime')
  })

  it('strips leading episode labels and infers anime on anime sites', () => {
    const fixture = `
      <!doctype html>
      <html lang="es">
        <head>
          <title>Episodio 4 - Niwatori Fighter - JKAnime</title>
        </head>
        <body>
          <main>
            <h1>Episodio 4 - Niwatori Fighter</h1>
            <p>El gallo del barrio defiende a la humanidad.</p>
          </main>
        </body>
      </html>
    `

    const result = detectCurrentDocument(
      parseFixture(fixture),
      'https://jkanime.net/niwatori-fighter/4/',
    )

    expect(result?.sourceSite).toBe('jkanime.net')
    expect(result?.title).toBe('Niwatori Fighter')
    expect(result?.episode).toBe(4)
    expect(result?.progressLabel).toBe('Ep 4')
    expect(result?.mediaType).toBe('anime')
  })

  it('prefers declared svg or png favicons over the default origin ico path', () => {
    const fixture = `
      <!doctype html>
      <html lang="en">
        <head>
          <title>Episode 4 - Demo Show</title>
          <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon" />
          <link rel="icon" href="https://cdn.example.com/icons/demo-show.svg" type="image/svg+xml" sizes="any" />
        </head>
        <body>
          <main>
            <h1>Episode 4 - Demo Show</h1>
          </main>
        </body>
      </html>
    `

    const result = detectCurrentDocument(
      parseFixture(fixture),
      'https://stream.example.com/demo-show/episode-4',
    )

    expect(result?.favicon).toBe('https://cdn.example.com/icons/demo-show.svg')
  })

  it('keeps declared ico favicons when the site publishes them outside the origin root', () => {
    const fixture = `
      <!doctype html>
      <html lang="es">
        <head>
          <title>Episodio 4 - Niwatori Fighter - JKAnime</title>
          <link rel="icon" href="https://cdn.jkdesa.com/assets3/css/img/favicon.ico?v=2.0.181" type="image/x-icon" />
        </head>
        <body>
          <main>
            <h1>Episodio 4 - Niwatori Fighter</h1>
          </main>
        </body>
      </html>
    `

    const result = detectCurrentDocument(
      parseFixture(fixture),
      'https://jkanime.net/niwatori-fighter/4/',
    )

    expect(result?.favicon).toBe('https://cdn.jkdesa.com/assets3/css/img/favicon.ico?v=2.0.181')
  })
})
