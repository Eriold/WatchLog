import type { MetadataProvider } from './provider'
import { createMetadataProvider } from './create-provider'

export class HybridMetadataProvider implements MetadataProvider {
  private readonly provider: MetadataProvider

  constructor(_legacyMockProvider?: MetadataProvider, provider: MetadataProvider = createMetadataProvider()) {
    this.provider = provider
  }

  async search(query?: string) {
    return this.provider.search(query)
  }

  async findByNormalizedTitle(normalizedTitle: string) {
    return this.provider.findByNormalizedTitle(normalizedTitle)
  }

  async getById(id: string) {
    return this.provider.getById(id)
  }
}
