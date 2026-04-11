import type { MetadataSource } from '../../../domains/metadata/contracts'
import type { MetadataQuery } from '../../../domains/metadata/contracts'
import type { MetadataCard } from '../../../shared/types'
import { AniListMetadataProvider } from '../../../shared/metadata/anilist-provider'

export class AniListMetadataSource implements MetadataSource {
  readonly id = 'anilist'
  readonly label = 'AniList'
  readonly domains = ['anime-manga', 'general'] as const
  readonly supportedMediaTypes = ['anime', 'manga', 'manhwa', 'manhua'] as const
  readonly capabilities = ['search', 'lookup-by-id', 'lookup-by-normalized-title'] as const
  readonly priority = 10

  private readonly provider: AniListMetadataProvider

  constructor(provider = new AniListMetadataProvider()) {
    this.provider = provider
  }

  async search(query: MetadataQuery): Promise<MetadataCard[]> {
    return this.provider.search(query.query ?? query.normalizedTitle)
  }

  async findByNormalizedTitle(query: MetadataQuery): Promise<MetadataCard | undefined> {
    if (!query.normalizedTitle) {
      return undefined
    }

    return this.provider.findByNormalizedTitle(query.normalizedTitle)
  }

  async getById(query: MetadataQuery): Promise<MetadataCard | undefined> {
    if (!query.id) {
      return undefined
    }

    return this.provider.getById(query.id)
  }
}
