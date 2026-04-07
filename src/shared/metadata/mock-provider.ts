import type { MetadataCard } from '../types'
import { normalizeTitle } from '../utils/normalize'
import { getMetadataNormalizedTitles, pickBestMetadataMatch } from './matching'
import type { MetadataProvider } from './provider'

function svgPoster(title: string, accent: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="420" height="620" viewBox="0 0 420 620">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${accent}" />
          <stop offset="100%" stop-color="#111827" />
        </linearGradient>
      </defs>
      <rect width="420" height="620" fill="url(#bg)" rx="32" />
      <circle cx="340" cy="90" r="58" fill="rgba(255,255,255,0.12)" />
      <circle cx="80" cy="520" r="84" fill="rgba(255,255,255,0.08)" />
      <text x="38" y="500" fill="#f8fafc" font-size="44" font-weight="700" font-family="Verdana, sans-serif">${title}</text>
      <text x="38" y="545" fill="#e5e7eb" font-size="20" font-family="Verdana, sans-serif">WatchLog Mock Library</text>
    </svg>
  `

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const MOCK_LIBRARY: MetadataCard[] = [
  {
    id: 'matrix',
    title: 'The Matrix',
    normalizedTitle: normalizeTitle('The Matrix'),
    mediaType: 'movie',
    poster: svgPoster('Matrix', '#16a34a'),
    genres: ['Action', 'Sci-Fi'],
    description: 'A hacker learns the reality he knows is a simulation controlled by machines.',
    releaseYear: 1999,
    runtime: 136,
    score: 8.7,
  },
  {
    id: 'matrix-reloaded',
    title: 'The Matrix Reloaded',
    normalizedTitle: normalizeTitle('The Matrix Reloaded'),
    mediaType: 'movie',
    poster: svgPoster('Reloaded', '#2563eb'),
    genres: ['Action', 'Sci-Fi'],
    description: 'Neo and the resistance push deeper into the war against the machines.',
    releaseYear: 2003,
    runtime: 138,
    score: 7.2,
  },
  {
    id: 'big-bang',
    title: 'The Big Bang Theory',
    normalizedTitle: normalizeTitle('The Big Bang Theory'),
    mediaType: 'series',
    poster: svgPoster('Big Bang', '#9333ea'),
    genres: ['Comedy', 'Sitcom'],
    description: 'A group of scientists navigate friendship, work and love in Pasadena.',
    releaseYear: 2007,
    seasonCount: 12,
    episodeCount: 279,
    score: 7.9,
  },
  {
    id: 'arcane',
    title: 'Arcane',
    normalizedTitle: normalizeTitle('Arcane'),
    mediaType: 'series',
    poster: svgPoster('Arcane', '#f59e0b'),
    genres: ['Animation', 'Fantasy'],
    description: 'Two sisters are pulled apart while conflict grows between two cities.',
    releaseYear: 2021,
    seasonCount: 2,
    episodeCount: 18,
    score: 9.0,
  },
  {
    id: 'frieren',
    title: 'Frieren: Beyond Journey’s End',
    normalizedTitle: normalizeTitle('Frieren Beyond Journeys End'),
    mediaType: 'anime',
    poster: svgPoster('Frieren', '#0f766e'),
    genres: ['Fantasy', 'Adventure'],
    description: 'An elf mage reflects on memory, loss and time after the hero party wins.',
    releaseYear: 2023,
    seasonCount: 1,
    episodeCount: 28,
    score: 9.1,
  },
  {
    id: 'one-piece',
    title: 'One Piece',
    normalizedTitle: normalizeTitle('One Piece'),
    mediaType: 'anime',
    poster: svgPoster('One Piece', '#ea580c'),
    genres: ['Adventure', 'Shounen'],
    description: 'A pirate crew searches for the legendary treasure while crossing the Grand Line.',
    releaseYear: 1999,
    episodeCount: 1100,
    score: 8.9,
  },
  {
    id: 'vagabond',
    title: 'Vagabond',
    normalizedTitle: normalizeTitle('Vagabond'),
    mediaType: 'manga',
    poster: svgPoster('Vagabond', '#dc2626'),
    genres: ['Historical', 'Seinen'],
    description: 'A retelling of Miyamoto Musashi’s journey through discipline and violence.',
    chapterCount: 327,
    score: 9.3,
  },
  {
    id: 'dune-part-two',
    title: 'Dune: Part Two',
    normalizedTitle: normalizeTitle('Dune Part Two'),
    mediaType: 'movie',
    poster: svgPoster('Dune', '#b45309'),
    genres: ['Sci-Fi', 'Adventure'],
    description: 'Paul Atreides joins the Fremen and embraces a larger destiny on Arrakis.',
    releaseYear: 2024,
    runtime: 166,
    score: 8.5,
  },
]

export class MockMetadataProvider implements MetadataProvider {
  async search(query?: string): Promise<MetadataCard[]> {
    if (!query?.trim()) {
      return MOCK_LIBRARY
    }

    const normalized = normalizeTitle(query)

    return MOCK_LIBRARY.filter((item) => {
      return (
        item.normalizedTitle.includes(normalized) ||
        item.genres.some((genre) => normalizeTitle(genre).includes(normalized))
      )
    })
  }

  async findByNormalizedTitle(normalizedTitle: string): Promise<MetadataCard | undefined> {
    const direct = MOCK_LIBRARY.find((item) =>
      getMetadataNormalizedTitles(item).includes(normalizedTitle),
    )
    if (direct) {
      return direct
    }

    return pickBestMetadataMatch(MOCK_LIBRARY, normalizedTitle)
  }

  async getById(id: string): Promise<MetadataCard | undefined> {
    return MOCK_LIBRARY.find((item) => item.id === id)
  }
}
