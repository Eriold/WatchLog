/** Resolves metadata for the currently selected library entry and exposes local override state. */
import { useEffect, useState } from 'react'
import { getMetadataForCatalogEntry } from '../../shared/client'
import type { LibraryEntry, MetadataCard } from '../../shared/types'

export function useSelectedEntryMetadata(selectedEntry: LibraryEntry | null) {
  const [selectedEntryMetadata, setSelectedEntryMetadata] = useState<MetadataCard | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!selectedEntry) {
      setSelectedEntryMetadata(null)
      return () => {
        cancelled = true
      }
    }

    setSelectedEntryMetadata(null)

    const loadMetadata = async () => {
      try {
        const metadata = await getMetadataForCatalogEntry(selectedEntry.catalog)
        if (!cancelled) {
          setSelectedEntryMetadata(metadata ?? null)
        }
      } catch (error) {
        console.warn('[WatchLog] library:selected-entry-metadata:error', error)
        if (!cancelled) {
          setSelectedEntryMetadata(null)
        }
      }
    }

    void loadMetadata()
    return () => {
      cancelled = true
    }
  }, [selectedEntry?.catalog.id])

  return {
    selectedEntryMetadata,
    setSelectedEntryMetadata,
  }
}
