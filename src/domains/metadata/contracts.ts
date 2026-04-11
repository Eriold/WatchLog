import type { MediaType, MetadataCard } from '../../shared/types'

export type MetadataSourceCapability = 'search' | 'lookup-by-id' | 'lookup-by-normalized-title'
export type MetadataDomain = 'anime-manga' | 'movies-series' | 'novels' | 'video-web' | 'general'

export interface MetadataQuery {
  query?: string
  normalizedTitle?: string
  id?: string
  preferredMediaTypes?: MediaType[]
  preferredSeason?: number
  domain?: MetadataDomain
}

export interface MetadataCandidate {
  sourceId: string
  item: MetadataCard
  matchedBy: 'search' | 'normalized-title' | 'id'
}

export interface MetadataSource {
  id: string
  label: string
  domains: readonly MetadataDomain[]
  supportedMediaTypes: readonly MediaType[]
  capabilities: readonly MetadataSourceCapability[]
  priority: number
  search(query: MetadataQuery): Promise<MetadataCard[]>
  findByNormalizedTitle(query: MetadataQuery): Promise<MetadataCard | undefined>
  getById(query: MetadataQuery): Promise<MetadataCard | undefined>
}
