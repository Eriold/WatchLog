import { describe, expect, it } from 'vitest'
import {
  extractOlympusBibliotecaCatalogSnapshot,
  isOlympusBibliotecaCatalogPage,
} from '../src/shared/catalog-import/olympusbiblioteca'

function parseFixture(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

describe('extractOlympusBibliotecaCatalogSnapshot', () => {
  it('detects OlympusBiblioteca profile pages from the URL', () => {
    expect(isOlympusBibliotecaCatalogPage('https://olympusbiblioteca.com/perfil')).toBe(true)
    expect(isOlympusBibliotecaCatalogPage('https://olympusbiblioteca.com/series/comic-x')).toBe(
      false,
    )
  })

  it('extracts visible titles, posters and the recovered profile list label', () => {
    const fixture = `
      <!doctype html>
      <html lang="es">
        <head>
          <title>Perfil | Olympus Biblioteca</title>
        </head>
        <body>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1 md:gap-4">
            <div>
              <div class="relative">
                <a href="https://olympusbiblioteca.com/series/comic-secta-de-la-montana-20260412-130709805" class="block rounded-md sf-ripple-container">
                  <div class="relative w-full aspect-[2.75/4.75] rounded-md">
                    <img src="https://dashboard.olympusbiblioteca.com/storage/comics/covers/127/64f80fde2f07c-lg.webp" alt="Secta de la montaña" loading="lazy" />
                  </div>
                </a>
                <div class="absolute-b-left w-full py-2 px-1 md:px-2 rounded-inherit text-center flex flex-col gap-2">
                  <a href="https://olympusbiblioteca.com/series/comic-secta-de-la-montana-20260412-130709805" class="rounded-md sf-ripple-container">
                    <h3 class="text-lg md:text-xl">Secta de la montaña</h3>
                  </a>
                  <button class="h-10 rounded-full border border-gray-700 backdrop-blur sf-ripple-container">
                    <div class="flex-center gap-2 text-2xl">
                      <i class="i-heroicons-check-20-solid"></i>
                      <div class="text-sm">Seguidos</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `

    const result = extractOlympusBibliotecaCatalogSnapshot(
      parseFixture(fixture),
      'https://olympusbiblioteca.com/perfil',
    )

    expect(result).not.toBeNull()
    expect(result?.sourceSite).toBe('olympusbiblioteca.com')
    expect(result?.listId).toBeNull()
    expect(result?.listLabel).toBe('Historial')
    expect(result?.visibleCount).toBe(1)
    expect(result?.items[0]).toMatchObject({
      sourceId: 'https://olympusbiblioteca.com/series/comic-secta-de-la-montana-20260412-130709805',
      title: 'Secta de la montaña',
      mediaType: 'manga',
      posterUrl: 'https://dashboard.olympusbiblioteca.com/storage/comics/covers/127/64f80fde2f07c-lg.webp',
      tags: ['Seguidos'],
    })
  })

  it('extracts the full Olympus grid from the provided profile HTML', () => {
    const fixture = `
      <!doctype html>
      <html lang="es">
        <head>
          <title>Perfil | Olympus Biblioteca</title>
        </head>
        <body>
          <main class="container mx-auto relative z-10">
            <section class="mt-8">
              <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1 md:gap-4">
                <div>
                  <div class="relative">
                    <a href="/series/comic-secta-de-la-montana-20260412-130709805" class="block rounded-md sf-ripple-container">
                      <div class="relative w-full aspect-[2.75/4.75] rounded-md">
                        <img src="https://dashboard.olympusbiblioteca.com/storage/comics/covers/127/64f80fde2f07c-lg.webp" alt="Secta de la montaña" loading="lazy" class="object-cover rounded-inherit w-full h-full" style="min-height: initial;" />
                      </div>
                    </a>
                    <div class="absolute-b-left w-full py-2 px-1 md:px-2 rounded-inherit text-center flex flex-col gap-2">
                      <a href="/series/comic-secta-de-la-montana-20260412-130709805" class="rounded-md sf-ripple-container">
                        <h3 class="text-lg md:text-xl">Secta de la montaña</h3>
                      </a>
                      <button class="h-10 rounded-full border border-gray-700 backdrop-blur sf-ripple-container">
                        <div class="flex-center gap-2 text-2xl">
                          <i class="i-heroicons-check-20-solid"></i>
                          <div class="text-sm">Seguidos</div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <div class="relative">
                    <a href="/series/comic-mi-invocacion-es-de-clase-ex" class="block rounded-md sf-ripple-container">
                      <div class="relative w-full aspect-[2.75/4.75] rounded-md">
                        <img src="https://dashboard.olympusbiblioteca.com/storage/comics/covers/1700/tmp4x3r318t-lg.webp" alt="Mi Invocación es de Clase EX" loading="lazy" class="object-cover rounded-inherit w-full h-full" style="min-height: initial;" />
                      </div>
                    </a>
                    <div class="absolute-b-left w-full py-2 px-1 md:px-2 rounded-inherit text-center flex flex-col gap-2">
                      <a href="/series/comic-mi-invocacion-es-de-clase-ex" class="rounded-md sf-ripple-container">
                        <h3 class="text-lg md:text-xl">Mi Invocación es de Clase EX</h3>
                      </a>
                      <button class="h-10 rounded-full border border-gray-700 backdrop-blur sf-ripple-container">
                        <div class="flex-center gap-2 text-2xl">
                          <i class="i-heroicons-check-20-solid"></i>
                          <div class="text-sm">Seguidos</div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <div class="relative">
                    <a href="/series/comic-al-comienzo-del-periodo-primordial-tome-a-minghe-como-mi-hija-adoptiva" class="block rounded-md sf-ripple-container">
                      <div class="relative w-full aspect-[2.75/4.75] rounded-md">
                        <img src="https://dashboard.olympusbiblioteca.com/storage/comics/covers/1465/1-lg.webp" alt="Al Comienzo del Período Primordial, Tomé a Minghe como mi Hija Adoptiva" loading="lazy" class="object-cover rounded-inherit w-full h-full" style="min-height: initial;" />
                      </div>
                    </a>
                    <div class="absolute-b-left w-full py-2 px-1 md:px-2 rounded-inherit text-center flex flex-col gap-2">
                      <a href="/series/comic-al-comienzo-del-periodo-primordial-tome-a-minghe-como-mi-hija-adoptiva" class="rounded-md sf-ripple-container">
                        <h3 class="text-lg md:text-xl">Al Comienzo del Período Primordial, Tomé a Minghe como mi Hija Adoptiva</h3>
                      </a>
                      <button class="h-10 rounded-full border border-gray-700 backdrop-blur sf-ripple-container">
                        <div class="flex-center gap-2 text-2xl">
                          <i class="i-heroicons-check-20-solid"></i>
                          <div class="text-sm">Seguidos</div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <div class="relative">
                    <a href="/series/comic-mago-prismatico-genio-20260412-130924101" class="block rounded-md sf-ripple-container">
                      <div class="relative w-full aspect-[2.75/4.75] rounded-md">
                        <img src="https://dashboard.olympusbiblioteca.com/storage/comics/covers/1478/tmp_gmpqep0-lg.webp" alt="Mago prismático genio" loading="lazy" class="object-cover rounded-inherit w-full h-full" style="min-height: initial;" />
                      </div>
                    </a>
                    <div class="absolute-b-left w-full py-2 px-1 md:px-2 rounded-inherit text-center flex flex-col gap-2">
                      <a href="/series/comic-mago-prismatico-genio-20260412-130924101" class="rounded-md sf-ripple-container">
                        <h3 class="text-lg md:text-xl">Mago prismático genio</h3>
                      </a>
                      <button class="h-10 rounded-full border border-gray-700 backdrop-blur sf-ripple-container">
                        <div class="flex-center gap-2 text-2xl">
                          <i class="i-heroicons-check-20-solid"></i>
                          <div class="text-sm">Seguidos</div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </main>
        </body>
      </html>
    `

    const result = extractOlympusBibliotecaCatalogSnapshot(
      parseFixture(fixture),
      'https://olympusbiblioteca.com/perfil',
    )

    expect(result).not.toBeNull()
    expect(result?.visibleCount).toBe(4)
    expect(result?.items.map((item) => item.title)).toEqual([
      'Secta de la montaña',
      'Mi Invocación es de Clase EX',
      'Al Comienzo del Período Primordial, Tomé a Minghe como mi Hija Adoptiva',
      'Mago prismático genio',
    ])
  })
})
