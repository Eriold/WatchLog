import { pickBestMetadataMatch } from '../../shared/metadata/matching'
import type { MetadataCard } from '../../shared/types'
import type { MetadataCandidate, MetadataQuery } from './contracts'

export interface MetadataMergePolicy {
  pickBest(candidates: MetadataCandidate[], query: MetadataQuery): MetadataCard | undefined
}

export class SimpleMetadataMergePolicy implements MetadataMergePolicy {
  pickBest(candidates: MetadataCandidate[], query: MetadataQuery): MetadataCard | undefined {
    if (candidates.length === 0) {
      return undefined
    }

    const targetQuery = query.normalizedTitle ?? query.query ?? ''
    if (!targetQuery.trim()) {
      return candidates[0]?.item
    }

    return pickBestMetadataMatch(
      candidates.map((candidate) => candidate.item),
      targetQuery,
      query.preferredMediaTypes,
      query.preferredSeason,
    )
  }
}
