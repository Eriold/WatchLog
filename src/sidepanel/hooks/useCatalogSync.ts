/** Runs pending catalog metadata sync sequentially and tracks progress, queue state, and summary modal data. */
import { useState, type Dispatch, type SetStateAction } from 'react'
import { resolveDetectionMetadata, saveDetection } from '../../shared/client'
import { getLocalizedMediaTypeLabel } from '../../shared/i18n/helpers'
import type { I18nValue } from '../../shared/i18n/context'
import { areMediaTypesCompatible } from '../../shared/metadata/matching'
import type { LibraryEntry, WatchLogSnapshot } from '../../shared/types'
import type { CatalogSyncSummary } from '../types'
import { buildDetectionForCatalogSync } from '../utils/catalog-sync'

type UseCatalogSyncParams = {
  pendingEntries: LibraryEntry[]
  setSnapshot: Dispatch<SetStateAction<WatchLogSnapshot>>
  t: I18nValue['t']
}

export function useCatalogSync({ pendingEntries, setSnapshot, t }: UseCatalogSyncParams) {
  const [syncingCatalogIds, setSyncingCatalogIds] = useState<string[]>([])
  const [catalogSyncProgress, setCatalogSyncProgress] = useState<{
    processed: number
    total: number
  } | null>(null)
  const [catalogSyncSummary, setCatalogSyncSummary] = useState<CatalogSyncSummary | null>(null)

  async function handleSyncPendingCatalog(): Promise<void> {
    if (catalogSyncProgress !== null || pendingEntries.length === 0) return

    const queue = pendingEntries
    const resolvedTitles: string[] = []
    const failedItems: CatalogSyncSummary['failedItems'] = []

    setCatalogSyncSummary(null)
    setSyncingCatalogIds(queue.map((entry) => entry.catalog.id))
    setCatalogSyncProgress({ processed: 0, total: queue.length })

    try {
      for (let index = 0; index < queue.length; index += 1) {
        const entry = queue[index]
        let failureReason: string | null = null

        try {
          if (!['anime', 'manga', 'manhwa', 'manhua'].includes(entry.catalog.mediaType)) {
            failureReason = t('library.syncReasonUnsupportedType', {
              type: getLocalizedMediaTypeLabel(entry.catalog.mediaType, t),
            })
          } else {
            const detection = buildDetectionForCatalogSync(entry)
            const metadata = await resolveDetectionMetadata(detection)
            if (!metadata) {
              failureReason = t('library.syncReasonNoMatch')
            } else if (!areMediaTypesCompatible(metadata.mediaType, entry.catalog.mediaType)) {
              failureReason = t('library.syncReasonTypeMismatch', {
                expected: getLocalizedMediaTypeLabel(entry.catalog.mediaType, t),
                received: getLocalizedMediaTypeLabel(metadata.mediaType, t),
              })
            } else {
              const response = await saveDetection({
                detection,
                listId: entry.activity.status,
                favorite: entry.activity.favorite,
                metadata,
                metadataSyncStatus: 'synced',
                skipMetadataLookup: true,
                disableTemporaryPoster: true,
              })

              setSnapshot(response.snapshot)
              resolvedTitles.push(entry.catalog.title)
            }
          }
        } catch (error) {
          failureReason = t('library.syncReasonRequestFailed', {
            reason: error instanceof Error ? error.message : 'sync-failed',
          })
        }

        if (failureReason) {
          failedItems.push({ title: entry.catalog.title, reason: failureReason })
        }

        setSyncingCatalogIds((current) => current.filter((catalogId) => catalogId !== entry.catalog.id))
        setCatalogSyncProgress({ processed: index + 1, total: queue.length })

        if (index < queue.length - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 7000))
        }
      }
    } finally {
      setSyncingCatalogIds([])
      setCatalogSyncProgress(null)
      setCatalogSyncSummary({ total: queue.length, resolvedTitles, failedItems })
    }
  }

  return {
    catalogSyncProgress,
    catalogSyncSummary,
    syncingCatalogIds,
    setCatalogSyncSummary,
    handleSyncPendingCatalog,
  }
}
