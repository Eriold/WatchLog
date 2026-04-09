import type { CatalogEntry } from './types'

export function isCatalogMetadataSynced(catalog: Pick<CatalogEntry, 'metadataSyncStatus'>): boolean {
  return catalog.metadataSyncStatus === 'synced'
}

export function isCatalogMetadataPending(catalog: Pick<CatalogEntry, 'metadataSyncStatus'>): boolean {
  return catalog.metadataSyncStatus === 'pending'
}
