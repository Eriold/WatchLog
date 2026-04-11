import type { MediaType, MetadataCard } from '../../shared/types'
import type { MetadataProvider } from '../../shared/metadata/provider'
import type { MetadataQuery } from './contracts'
import type { MetadataResolver } from './resolver'

function inferMediaTypes(query?: string): MediaType[] {
  if (!query) {
    return []
  }

  const value = query.toLowerCase()
  if (/\b(manga|manhwa|manhua|webtoon)\b/.test(value)) {
    return ['manga', 'manhwa', 'manhua']
  }

  if (/\b(anime|season|episode)\b/.test(value)) {
    return ['anime']
  }

  return []
}

export class ResolverMetadataProvider implements MetadataProvider {
  private readonly resolver: MetadataResolver

  constructor(resolver: MetadataResolver) {
    this.resolver = resolver
  }

  async search(query?: string): Promise<MetadataCard[]> {
    const metadataQuery: MetadataQuery = {
      query,
      preferredMediaTypes: inferMediaTypes(query),
    }

    return this.resolver.search(metadataQuery)
  }

  async findByNormalizedTitle(normalizedTitle: string): Promise<MetadataCard | undefined> {
    return this.resolver.findByNormalizedTitle({
      normalizedTitle,
    })
  }

  async getById(id: string): Promise<MetadataCard | undefined> {
    return this.resolver.getById({ id })
  }
}
