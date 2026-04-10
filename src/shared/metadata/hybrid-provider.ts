import type { MetadataCard } from '../types'
import { AniListMetadataProvider } from './anilist-provider'
import type { MetadataProvider } from './provider'

export class HybridMetadataProvider implements MetadataProvider {
  private readonly aniListProvider: MetadataProvider

  constructor(
    _legacyMockProvider?: MetadataProvider,
    aniListProvider: MetadataProvider = new AniListMetadataProvider(),
  ) {
    this.aniListProvider = aniListProvider
  }

  async search(query?: string): Promise<MetadataCard[]> {
    return this.aniListProvider.search(query)
  }

  async findByNormalizedTitle(normalizedTitle: string): Promise<MetadataCard | undefined> {
    return this.aniListProvider.findByNormalizedTitle(normalizedTitle)
  }

  async getById(id: string): Promise<MetadataCard | undefined> {
    return this.aniListProvider.getById(id)
  }
}
