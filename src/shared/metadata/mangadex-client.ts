import { STORAGE_KEYS } from '../constants'
import { storageGet, storageSet } from '../storage/browser'
import type { MetadataCard } from '../types'
import { normalizeTitle } from '../utils/normalize'

const MANGADEX_API_URL = 'https://api.mangadex.org'
const SEARCH_TTL_MS = 1000 * 60 * 60 * 12
const DETAIL_TTL_MS = 1000 * 60 * 60 * 24
const STATISTICS_TTL_MS = 1000 * 60 * 60 * 24

interface MangaDexStatisticsResponse {
  result?: string
  statistics?: Record<
    string,
    {
      rating?: {
        average?: number | null
        bayesian?: number | null
      } | null
    }
  >
}

interface MangaDexRelationship {
  id: string
  type: string
  attributes?: {
    fileName?: string
  }
}

export interface MangaDexManga {
  id: string
  type: string
  attributes: {
    title?: Record<string, string>
    altTitles?: Record<string, string>[]
    description?: Record<string, string>
    originalLanguage?: string
    status?: string
    year?: number | null
    lastChapter?: string | null
    publicationDemographic?: string | null
    contentRating?: string | null
    availableTranslatedLanguages?: string[]
  }
  relationships?: MangaDexRelationship[]
}

interface MangaDexSearchResponse {
  result?: string
  data?: MangaDexManga[]
}

interface CacheEntry<TValue> {
  expiresAt: number
  value: TValue
}

type CacheStore = Record<string, CacheEntry<unknown>>

function canUseChromeStorage(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.storage !== 'undefined' &&
    typeof chrome.storage.local !== 'undefined'
  )
}

function pickLocalizedString(input?: Record<string, string> | null): string | undefined {
  if (!input) {
    return undefined
  }

  return (
    input.en?.trim() ||
    input['ja-ro']?.trim() ||
    input.romaji?.trim() ||
    input.native?.trim() ||
    Object.values(input).find((value) => value?.trim())?.trim() ||
    undefined
  )
}

function pickDescription(input?: Record<string, string> | null): string {
  if (!input) {
    return 'No description available yet.'
  }

  return (
    input.en?.trim() ||
    input['ja-ro']?.trim() ||
    Object.values(input).find((value) => value?.trim())?.trim() ||
    'No description available yet.'
  )
}

function mapStatus(status?: string | null): 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS' | undefined {
  switch (status?.toLowerCase()) {
    case 'completed':
      return 'FINISHED'
    case 'ongoing':
      return 'RELEASING'
    case 'hiatus':
      return 'HIATUS'
    case 'cancelled':
      return 'CANCELLED'
    case 'not_yet_released':
      return 'NOT_YET_RELEASED'
    default:
      return undefined
  }
}

function mapOriginalLanguageToMediaType(language?: string | null): 'manga' | 'manhwa' | 'manhua' {
  switch (language?.toLowerCase()) {
    case 'ko':
      return 'manhwa'
    case 'zh':
      return 'manhua'
    default:
      return 'manga'
  }
}

function buildCoverUrl(mangaId: string, fileName?: string): string | undefined {
  if (!fileName) {
    return undefined
  }

  return `https://uploads.mangadex.org/covers/${mangaId}/${fileName}.512.jpg`
}

export class MangaDexClient {
  private readonly memoryCache = new Map<string, CacheEntry<unknown>>()

  private async readCache<TValue>(key: string): Promise<TValue | undefined> {
    const memory = this.memoryCache.get(key)
    if (memory && memory.expiresAt > Date.now()) {
      return memory.value as TValue
    }

    if (!canUseChromeStorage()) {
      return undefined
    }

    const cacheStore = await storageGet<CacheStore>(chrome.storage.local, STORAGE_KEYS.mangadexCache, {})
    const cached = cacheStore[key]

    if (!cached || cached.expiresAt <= Date.now()) {
      return undefined
    }

    this.memoryCache.set(key, cached)
    return cached.value as TValue
  }

  private async writeCache<TValue>(key: string, value: TValue, ttlMs: number): Promise<void> {
    const entry: CacheEntry<TValue> = {
      expiresAt: Date.now() + ttlMs,
      value,
    }

    this.memoryCache.set(key, entry)

    if (!canUseChromeStorage()) {
      return
    }

    const cacheStore = await storageGet<CacheStore>(chrome.storage.local, STORAGE_KEYS.mangadexCache, {})
    cacheStore[key] = entry as CacheEntry<unknown>
    await storageSet(chrome.storage.local, STORAGE_KEYS.mangadexCache, cacheStore)
  }

  private async requestJson<TResponse>(url: string): Promise<TResponse> {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`MangaDex request failed with status ${response.status}.`)
    }

    return (await response.json()) as TResponse
  }

  private async getStatistics(mangaId: string): Promise<number | undefined> {
    const cacheKey = `stats:${mangaId}`
    const cached = await this.readCache<number>(cacheKey)
    if (cached !== undefined) {
      return cached
    }

    const data = await this.requestJson<MangaDexStatisticsResponse>(
      `${MANGADEX_API_URL}/statistics/manga/${mangaId}`,
    )
    const score = data.statistics?.[mangaId]?.rating?.bayesian ?? undefined

    if (score !== undefined) {
      await this.writeCache(cacheKey, score, STATISTICS_TTL_MS)
    }

    return score
  }

  async search(query?: string): Promise<MetadataCard[]> {
    const trimmedQuery = query?.trim()
    if (!trimmedQuery) {
      return []
    }

    const cacheKey = `search:${trimmedQuery.toLowerCase()}`
    const cached = await this.readCache<MetadataCard[]>(cacheKey)
    if (cached) {
      return cached
    }

    const params = new URLSearchParams()
    params.set('title', trimmedQuery)
    params.set('limit', '8')
    params.append('includes[]', 'cover_art')
    params.append('includes[]', 'author')
    params.append('includes[]', 'artist')

    const data = await this.requestJson<MangaDexSearchResponse>(
      `${MANGADEX_API_URL}/manga?${params.toString()}`,
    )
    const mangas = Array.isArray(data.data) ? data.data : []

    const items = await Promise.all(
      mangas.map(async (manga) => {
        const title = pickLocalizedString(manga.attributes.title) ?? `MangaDex ${manga.id}`
        const aliases = [
          ...(manga.attributes.altTitles ?? [])
            .map((entry) => pickLocalizedString(entry))
            .filter((entry): entry is string => Boolean(entry)),
          ...Object.values(manga.attributes.title ?? {})
            .map((value) => value?.trim())
            .filter((value): value is string => Boolean(value)),
        ]
        const coverArt = manga.relationships?.find((relationship) => relationship.type === 'cover_art')
        const score = await this.getStatistics(manga.id)
        const mediaType = mapOriginalLanguageToMediaType(manga.attributes.originalLanguage)
        const sourceUrl = `https://mangadex.org/title/${manga.id}`

        return {
          id: `mangadex:${manga.id}`,
          title,
          normalizedTitle: normalizeTitle(title),
          aliases: Array.from(new Set(aliases.filter((value) => value !== title))),
          sourceUrl,
          mediaType,
          poster: buildCoverUrl(manga.id, coverArt?.attributes?.fileName),
          genres: [],
          description: pickDescription(manga.attributes.description),
          publicationStatus: mapStatus(manga.attributes.status),
          releaseYear: manga.attributes.year ?? undefined,
          chapterCount:
            manga.attributes.lastChapter && !Number.isNaN(Number(manga.attributes.lastChapter))
              ? Number(manga.attributes.lastChapter)
              : undefined,
          score,
        } satisfies MetadataCard
      }),
    )

    await this.writeCache(cacheKey, items, SEARCH_TTL_MS)
    for (const item of items) {
      await this.writeCache(`detail:${item.id}`, item, DETAIL_TTL_MS)
    }

    return items
  }

  async getById(id: string): Promise<MetadataCard | undefined> {
    const cacheKey = `detail:${id}`
    const cached = await this.readCache<MetadataCard>(cacheKey)
    if (cached) {
      return cached
    }

    if (!id.startsWith('mangadex:')) {
      return undefined
    }

    const mangaId = id.slice('mangadex:'.length)
    const data = await this.requestJson<{ data?: MangaDexManga }>(
      `${MANGADEX_API_URL}/manga/${mangaId}?includes[]=cover_art&includes[]=author&includes[]=artist`,
    )
    const manga = data.data
    if (!manga) {
      return undefined
    }

    const title = pickLocalizedString(manga.attributes.title) ?? `MangaDex ${manga.id}`
    const coverArt = manga.relationships?.find((relationship) => relationship.type === 'cover_art')
    const item = {
      id: `mangadex:${manga.id}`,
      title,
      normalizedTitle: normalizeTitle(title),
      aliases: [
        ...(manga.attributes.altTitles ?? [])
          .map((entry) => pickLocalizedString(entry))
          .filter((entry): entry is string => Boolean(entry)),
      ].filter((alias) => alias !== title),
      sourceUrl: `https://mangadex.org/title/${manga.id}`,
      mediaType: mapOriginalLanguageToMediaType(manga.attributes.originalLanguage),
      poster: buildCoverUrl(manga.id, coverArt?.attributes?.fileName),
      genres: [],
      description: pickDescription(manga.attributes.description),
      publicationStatus: mapStatus(manga.attributes.status),
      releaseYear: manga.attributes.year ?? undefined,
      chapterCount:
        manga.attributes.lastChapter && !Number.isNaN(Number(manga.attributes.lastChapter))
          ? Number(manga.attributes.lastChapter)
          : undefined,
      score: await this.getStatistics(manga.id),
    } satisfies MetadataCard

    await this.writeCache(cacheKey, item, DETAIL_TTL_MS)
    return item
  }

  async findByNormalizedTitle(normalizedTitle: string): Promise<MetadataCard | undefined> {
    const query = normalizedTitle.trim()
    if (!query) {
      return undefined
    }

    const results = await this.search(query)
    return results.find((item) => item.normalizedTitle === normalizedTitle)
  }
}
