import { STORAGE_KEYS } from '../constants'
import { storageGet, storageSet } from '../storage/browser'
import type { AniListMedia, AniListMediaType } from './anilist-mappers'

const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co'
const SEARCH_TTL_MS = 1000 * 60 * 60 * 12
const DETAIL_TTL_MS = 1000 * 60 * 60 * 24

interface AniListGraphQLError {
  message?: string
  status?: number
}

interface AniListGraphQLResponse<TData> {
  data?: TData
  errors?: AniListGraphQLError[]
}

interface AniListSearchResponse {
  Page?: {
    media?: AniListMedia[] | null
  } | null
}

interface AniListDetailResponse {
  Media?: AniListMedia | null
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

export class AniListClient {
  private readonly memoryCache = new Map<string, CacheEntry<unknown>>()

  private async readCache<TValue>(key: string): Promise<TValue | undefined> {
    const memory = this.memoryCache.get(key)
    if (memory && memory.expiresAt > Date.now()) {
      return memory.value as TValue
    }

    if (!canUseChromeStorage()) {
      return undefined
    }

    const cacheStore = await storageGet<CacheStore>(
      chrome.storage.local,
      STORAGE_KEYS.anilistCache,
      {},
    )
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

    const cacheStore = await storageGet<CacheStore>(
      chrome.storage.local,
      STORAGE_KEYS.anilistCache,
      {},
    )

    cacheStore[key] = entry as CacheEntry<unknown>
    await storageSet(chrome.storage.local, STORAGE_KEYS.anilistCache, cacheStore)
  }

  private async request<TData, TVariables extends Record<string, unknown>>(
    query: string,
    variables: TVariables,
  ): Promise<TData> {
    const response = await fetch(ANILIST_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    })

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After')
      throw new Error(
        retryAfter
          ? `AniList rate limit reached. Retry in ${retryAfter} seconds.`
          : 'AniList rate limit reached. Retry in a moment.',
      )
    }

    if (!response.ok) {
      throw new Error(`AniList request failed with status ${response.status}.`)
    }

    const payload = (await response.json()) as AniListGraphQLResponse<TData>

    if (payload.errors && payload.errors.length > 0) {
      throw new Error(payload.errors[0]?.message ?? 'AniList GraphQL error.')
    }

    if (!payload.data) {
      throw new Error('AniList returned no data.')
    }

    return payload.data
  }

  async searchMedia(search: string, type: AniListMediaType): Promise<AniListMedia[]> {
    const normalizedQuery = search.trim()
    if (!normalizedQuery) {
      return []
    }

    const cacheKey = `search:${type}:${normalizedQuery.toLowerCase()}`
    const cached = await this.readCache<AniListMedia[]>(cacheKey)
    if (cached) {
      return cached
    }

    const query = `
      query SearchMedia($search: String, $type: MediaType, $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(search: $search, type: $type, sort: POPULARITY_DESC) {
            id
            type
            format
            status
            startDate {
              year
              month
              day
            }
            endDate {
              year
              month
              day
            }
            episodes
            chapters
            duration
            seasonYear
            genres
            description(asHtml: false)
            averageScore
            title {
              romaji
              english
              native
            }
            coverImage {
              extraLarge
              large
              medium
            }
            bannerImage
            nextAiringEpisode {
              episode
            }
          }
        }
      }
    `

    const data = await this.request<AniListSearchResponse, Record<string, unknown>>(query, {
      search: normalizedQuery,
      type,
      page: 1,
      perPage: 8,
    })

    const media = data.Page?.media?.filter(Boolean) ?? []
    await this.writeCache(cacheKey, media, SEARCH_TTL_MS)

    for (const item of media) {
      await this.writeCache(`detail:${item.id}`, item, DETAIL_TTL_MS)
    }

    return media
  }

  async getMediaById(id: number): Promise<AniListMedia | undefined> {
    const cacheKey = `detail:${id}`
    const cached = await this.readCache<AniListMedia>(cacheKey)
    if (cached) {
      return cached
    }

    const query = `
      query MediaDetails($id: Int) {
        Media(id: $id) {
          id
          type
          format
          status
          startDate {
            year
            month
            day
          }
          endDate {
            year
            month
            day
          }
          episodes
          chapters
          duration
          seasonYear
          genres
          description(asHtml: false)
          averageScore
          title {
            romaji
            english
            native
          }
          coverImage {
            extraLarge
            large
            medium
          }
          bannerImage
          nextAiringEpisode {
            episode
          }
        }
      }
    `

    const data = await this.request<AniListDetailResponse, Record<string, unknown>>(query, { id })
    const media = data.Media ?? undefined

    if (media) {
      await this.writeCache(cacheKey, media, DETAIL_TTL_MS)
    }

    return media
  }
}
