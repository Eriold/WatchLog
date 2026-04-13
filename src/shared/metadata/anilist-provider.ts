import type { MetadataCard } from '../types'
import { AniListClient, type AniListSearchOptions } from './anilist-client'
import { mapAniListMediaToMetadataCard, type AniListMediaType } from './anilist-mappers'
import { getMetadataNormalizedTitles, pickBestMetadataMatch } from './matching'
import type { MetadataProvider } from './provider'

function parseAniListId(id: string): number | null {
  if (!id.startsWith('anilist:')) {
    return null
  }

  const rawId = id.slice('anilist:'.length)
  const parsed = Number.parseInt(rawId, 10)
  return Number.isFinite(parsed) ? parsed : null
}

export class AniListMetadataProvider implements MetadataProvider {
  private readonly client: AniListClient

  constructor(client = new AniListClient()) {
    this.client = client
  }

  async search(query?: string): Promise<MetadataCard[]> {
    const trimmedQuery = query?.trim()
    if (!trimmedQuery) {
      return []
    }

    return this.searchByTypes(trimmedQuery, 'ANIME', 'MANGA')
  }

  async searchByType(
    query: string | undefined,
    type: AniListMediaType,
    options: AniListSearchOptions = {},
  ): Promise<MetadataCard[]> {
    const trimmedQuery = query?.trim()
    if (!trimmedQuery) {
      return []
    }

    const media = await this.client.searchMedia(trimmedQuery, type, options)
    return media.map((item) => mapAniListMediaToMetadataCard(item))
  }

  async searchByTypes(
    query: string | undefined,
    ...types: AniListMediaType[]
  ): Promise<MetadataCard[]> {
    const trimmedQuery = query?.trim()
    if (!trimmedQuery) {
      return []
    }

    const seen = new Set<string>()
    const items: MetadataCard[] = []

    for (const type of types) {
      const results = await this.searchByType(trimmedQuery, type)

      for (const card of results) {
        const dedupeKey = `${card.mediaType}:${card.normalizedTitle}`
        if (seen.has(dedupeKey)) {
          continue
        }

        seen.add(dedupeKey)
        items.push(card)
      }
    }

    return items
  }

  async findByNormalizedTitle(normalizedTitle: string): Promise<MetadataCard | undefined> {
    const query = normalizedTitle.trim()
    if (!query) {
      return undefined
    }

    const cards = await this.search(query)
    const direct = cards.find((item) => getMetadataNormalizedTitles(item).includes(normalizedTitle))

    if (direct) {
      return direct
    }

    return pickBestMetadataMatch(cards, normalizedTitle, ['anime', 'manga'])
  }

  async findByNormalizedTitleForType(
    normalizedTitle: string,
    type: AniListMediaType,
    options: AniListSearchOptions = {},
  ): Promise<MetadataCard | undefined> {
    const query = normalizedTitle.trim()
    if (!query) {
      return undefined
    }

    const cards = await this.searchByType(query, type, options)
    const direct = cards.find((item) => getMetadataNormalizedTitles(item).includes(normalizedTitle))

    if (direct) {
      return direct
    }

    return pickBestMetadataMatch(cards, normalizedTitle, [type === 'ANIME' ? 'anime' : 'manga'])
  }

  async getById(id: string): Promise<MetadataCard | undefined> {
    const parsedId = parseAniListId(id)
    if (parsedId === null) {
      return undefined
    }

    const media = await this.client.getMediaById(parsedId)
    return media ? mapAniListMediaToMetadataCard(media) : undefined
  }
}
