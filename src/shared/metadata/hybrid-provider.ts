import type { MetadataCard } from '../types'
import { AniListMetadataProvider } from './anilist-provider'
import { pickBestMetadataMatch } from './matching'
import { MockMetadataProvider } from './mock-provider'
import type { MetadataProvider } from './provider'

function dedupeCards(items: MetadataCard[]): MetadataCard[] {
  const seen = new Set<string>()
  const result: MetadataCard[] = []

  for (const item of items) {
    const key = `${item.mediaType}:${item.normalizedTitle}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(item)
  }

  return result
}

export class HybridMetadataProvider implements MetadataProvider {
  private readonly mockProvider: MetadataProvider
  private readonly aniListProvider: MetadataProvider

  constructor(
    mockProvider: MetadataProvider = new MockMetadataProvider(),
    aniListProvider: MetadataProvider = new AniListMetadataProvider(),
  ) {
    this.mockProvider = mockProvider
    this.aniListProvider = aniListProvider
  }

  async search(query?: string): Promise<MetadataCard[]> {
    if (!query?.trim()) {
      return this.mockProvider.search()
    }

    const [aniListResults, mockResults] = await Promise.allSettled([
      this.aniListProvider.search(query),
      this.mockProvider.search(query),
    ])

    const merged = [
      ...(aniListResults.status === 'fulfilled' ? aniListResults.value : []),
      ...(mockResults.status === 'fulfilled' ? mockResults.value : []),
    ]

    return dedupeCards(merged)
  }

  async findByNormalizedTitle(normalizedTitle: string): Promise<MetadataCard | undefined> {
    const [mockMatch, aniListMatch] = await Promise.all([
      this.mockProvider.findByNormalizedTitle(normalizedTitle),
      this.aniListProvider.findByNormalizedTitle(normalizedTitle),
    ])

    return pickBestMetadataMatch(
      [mockMatch, aniListMatch].filter((item): item is MetadataCard => Boolean(item)),
      normalizedTitle,
    )
  }

  async getById(id: string): Promise<MetadataCard | undefined> {
    if (id.startsWith('anilist:')) {
      return this.aniListProvider.getById(id)
    }

    return (await this.mockProvider.getById(id)) ?? this.aniListProvider.getById(id)
  }
}
