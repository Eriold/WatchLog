import type { MetadataCard } from '../../shared/types'
import type { MetadataCandidate, MetadataQuery } from './contracts'
import type { MetadataMergePolicy } from './merge-policy'
import { MetadataSourceRegistry } from './source-registry'

export class MetadataResolver {
  private readonly registry: MetadataSourceRegistry
  private readonly mergePolicy: MetadataMergePolicy

  constructor(registry: MetadataSourceRegistry, mergePolicy: MetadataMergePolicy) {
    this.registry = registry
    this.mergePolicy = mergePolicy
  }

  async search(query: MetadataQuery): Promise<MetadataCard[]> {
    const sources = this.registry.select(query)
    const dedupeMap = new Map<string, MetadataCard>()

    for (const source of sources) {
      const items = await source.search(query)
      for (const item of items) {
        const dedupeKey = `${item.id}:${item.mediaType}:${item.normalizedTitle}`
        if (!dedupeMap.has(dedupeKey)) {
          dedupeMap.set(dedupeKey, item)
        }
      }
    }

    return Array.from(dedupeMap.values())
  }

  async findByNormalizedTitle(query: MetadataQuery): Promise<MetadataCard | undefined> {
    const sources = this.registry.select(query)
    const candidates: MetadataCandidate[] = []

    for (const source of sources) {
      const item = await source.findByNormalizedTitle(query)
      if (!item) {
        continue
      }

      candidates.push({
        sourceId: source.id,
        item,
        matchedBy: 'normalized-title',
      })
    }

    return this.mergePolicy.pickBest(candidates, query)
  }

  async getById(query: MetadataQuery): Promise<MetadataCard | undefined> {
    if (!query.id) {
      return undefined
    }

    const directSource = query.id.includes(':')
      ? this.registry.getById(query.id.split(':', 1)[0])
      : undefined

    if (directSource) {
      return directSource.getById(query)
    }

    const sources = this.registry.select(query)
    for (const source of sources) {
      const item = await source.getById(query)
      if (item) {
        return item
      }
    }

    return undefined
  }
}
