import type { MetadataCard } from '../types'

export interface MetadataProvider {
  search(query?: string): Promise<MetadataCard[]>
  findByNormalizedTitle(normalizedTitle: string): Promise<MetadataCard | undefined>
  getById(id: string): Promise<MetadataCard | undefined>
}
