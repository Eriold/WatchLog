import type { MetadataCard } from '../types'
import { getMetadataNormalizedTitles, pickBestMetadataMatch } from './matching'
import type { MetadataProvider } from './provider'
import { MangaDexClient } from './mangadex-client'

function parseMangaDexId(id: string): string | null {
  if (!id.startsWith('mangadex:')) {
    return null
  }

  return id.slice('mangadex:'.length).trim() || null
}

export class MangaDexMetadataProvider implements MetadataProvider {
  private readonly client: MangaDexClient

  constructor(client = new MangaDexClient()) {
    this.client = client
  }

  async search(query?: string): Promise<MetadataCard[]> {
    return this.client.search(query)
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

    return pickBestMetadataMatch(cards, normalizedTitle, ['manga', 'manhwa', 'manhua'])
  }

  async getById(id: string): Promise<MetadataCard | undefined> {
    const parsed = parseMangaDexId(id)
    if (!parsed) {
      return undefined
    }

    return this.client.getById(`mangadex:${parsed}`)
  }
}
