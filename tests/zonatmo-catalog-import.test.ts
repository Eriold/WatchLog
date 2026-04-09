import { describe, expect, it } from 'vitest'
import {
  extractZonaTmoCatalogSnapshot,
  isZonaTmoCatalogPage,
} from '../src/shared/catalog-import/zonatmo'

function parseFixture(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

describe('extractZonaTmoCatalogSnapshot', () => {
  it('detects ZonaTMO list pages from the URL', () => {
    expect(
      isZonaTmoCatalogPage('https://zonatmo.nakamasweb.com/lists/111297/favoritos'),
    ).toBe(true)
    expect(isZonaTmoCatalogPage('https://zonatmo.nakamasweb.com/library/manga/145/vinlandsaga')).toBe(
      false,
    )
  })

  it('extracts visible titles, type hints and poster URLs from a list page', () => {
    const fixture = `
      <!doctype html>
      <html lang="es">
        <head>
          <title>Favoritos - ZonaTMO</title>
        </head>
        <body>
          <div class="row">
            <div class="col-12">
              <h2>Elementos 2/100</h2>
            </div>

            <div class="element col-6" data-identifier="37300">
              <a href="https://zonatmo.nakamasweb.com/library/manga/37300/kami-tachi-ni-hirowareta-otoko">
                <div class="thumbnail book book-thumbnail-37300">
                  <style>
                    .book-thumbnail-37300::before{
                      background-image: url('https://otakuteca.com/images/books/cover/659a2b51681e3.webp');
                    }
                  </style>
                  <div class="thumbnail-title">
                    <h4 class="text-truncate" title="Kami-tachi ni Hirowareta Otoko">Kami-tachi ni Hirowareta Otoko</h4>
                  </div>
                  <span class="score"><span>8.50</span></span>
                  <span class="book-type badge badge-manga">MANGA</span>
                  <span class="demography shounen">Shounen</span>
                </div>
              </a>
            </div>

            <div class="element col-6" data-identifier="41401">
              <a href="https://zonatmo.nakamasweb.com/library/novel/41401/lavidadespuesdelamuertenovel">
                <div class="thumbnail book book-thumbnail-41401">
                  <style>
                    .book-thumbnail-41401::before{
                      background-image: url('https://otakuteca.com/images/books/cover/63b7596c48103.webp');
                    }
                  </style>
                  <div class="thumbnail-title">
                    <h4 class="text-truncate" title="La Vida Después de la Muerte">La Vida Después de la Muerte</h4>
                  </div>
                  <span class="score"><span>8.00</span></span>
                  <span class="book-type badge badge-novel">NOVELA</span>
                  <span class="demography seinen">Seinen</span>
                </div>
              </a>
            </div>
          </div>
        </body>
      </html>
    `

    const result = extractZonaTmoCatalogSnapshot(
      parseFixture(fixture),
      'https://zonatmo.nakamasweb.com/lists/111297/favoritos',
    )

    expect(result).not.toBeNull()
    expect(result?.listId).toBe('111297')
    expect(result?.listSlug).toBe('favoritos')
    expect(result?.listLabel).toBe('Favoritos')
    expect(result?.visibleCount).toBe(2)
    expect(result?.reportedCount).toBe(2)
    expect(result?.maxCount).toBe(100)
    expect(result?.items[0]).toMatchObject({
      sourceId: '37300',
      title: 'Kami-tachi ni Hirowareta Otoko',
      mediaType: 'manga',
      score: 8.5,
      posterUrl: 'https://otakuteca.com/images/books/cover/659a2b51681e3.webp',
      tags: ['Shounen', 'MANGA'],
    })
    expect(result?.items[1]).toMatchObject({
      sourceId: '41401',
      title: 'La Vida Después de la Muerte',
      mediaType: 'novel',
      score: 8,
      posterUrl: 'https://otakuteca.com/images/books/cover/63b7596c48103.webp',
      tags: ['Seinen', 'NOVELA'],
    })
  })
})
