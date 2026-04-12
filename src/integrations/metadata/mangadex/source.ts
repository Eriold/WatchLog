import type { MetadataSource, MetadataQuery } from '../../../domains/metadata/contracts'
import type { MetadataCard } from '../../../shared/types'
import { MangaDexMetadataProvider } from '../../../shared/metadata/mangadex-provider'

export class MangaDexMetadataSource implements MetadataSource {
  readonly id = 'mangadex'
  readonly label = 'MangaDex'
  readonly domains = ['anime-manga', 'general'] as const
  readonly supportedMediaTypes = ['manga', 'manhwa', 'manhua'] as const
  readonly capabilities = ['search', 'lookup-by-id', 'lookup-by-normalized-title'] as const
  readonly priority = 20

  private readonly provider: MangaDexMetadataProvider

  constructor(provider = new MangaDexMetadataProvider()) {
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
