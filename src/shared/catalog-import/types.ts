import type { MediaType } from '../types'

export interface CatalogImportItem {
  sourceId: string
  title: string
  normalizedTitle: string
  sourceUrl: string
  posterUrl?: string
  mediaType: MediaType
  sourceTypeLabel?: string
  tags: string[]
  score?: number
}

export interface CatalogImportSnapshot {
  sourceSite: string
  sourceUrl: string
  listId: string | null
  listSlug: string | null
  listLabel: string
  visibleCount: number
  reportedCount?: number
  maxCount?: number
  items: CatalogImportItem[]
}
