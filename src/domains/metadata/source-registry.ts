import type { MediaType } from '../../shared/types'
import type { MetadataDomain, MetadataQuery, MetadataSource } from './contracts'

function inferDomain(query: MetadataQuery): MetadataDomain {
  const mediaTypes = query.preferredMediaTypes ?? []

  if (mediaTypes.some((item) => ['anime', 'manga', 'manhwa', 'manhua'].includes(item))) {
    return 'anime-manga'
  }

  if (mediaTypes.some((item) => item === 'movie' || item === 'series')) {
    return 'movies-series'
  }

  if (mediaTypes.includes('novel')) {
    return 'novels'
  }

  if (mediaTypes.includes('video')) {
    return 'video-web'
  }

  return query.domain ?? 'general'
}

function isMediaTypeSupported(
  sourceMediaTypes: readonly MediaType[],
  preferredMediaTypes: MediaType[],
): boolean {
  if (preferredMediaTypes.length === 0) {
    return true
  }

  return preferredMediaTypes.some((mediaType) => sourceMediaTypes.includes(mediaType))
}

export class MetadataSourceRegistry {
  private readonly sources: MetadataSource[]

  constructor(sources: MetadataSource[]) {
    this.sources = [...sources].sort((left, right) => left.priority - right.priority)
  }

  getAll(): MetadataSource[] {
    return [...this.sources]
  }

  getById(sourceId: string): MetadataSource | undefined {
    return this.sources.find((source) => source.id === sourceId)
  }

  select(query: MetadataQuery): MetadataSource[] {
    const preferredMediaTypes = query.preferredMediaTypes ?? []
    const domain = inferDomain(query)

    return this.sources.filter((source) => {
      const domainMatches =
        source.domains.includes('general') ||
        source.domains.includes(domain) ||
        domain === 'general'

      return domainMatches && isMediaTypeSupported(source.supportedMediaTypes, preferredMediaTypes)
    })
  }
}
