/** Performs manual AniList refresh for the selected entry and keeps its loading/error state isolated. */
import { useState, type Dispatch, type SetStateAction } from 'react'
import { refreshAniListMetadata, updateEntry } from '../../shared/client'
import { getLocalizedMediaTypeLabel } from '../../shared/i18n/helpers'
import type { I18nValue } from '../../shared/i18n/context'
import type { LibraryEntry, MetadataCard, WatchLogSnapshot } from '../../shared/types'
import type { EntryDraft, LibraryStatusMessageState } from '../types'
import { buildDetectionForCatalogSync } from '../utils/catalog-sync'
import { createEntryDraft } from '../utils/progress-helpers'

type UseEntryAniListRefreshParams = {
  selectedCatalogId: string | null
  selectedDraft: EntryDraft | null
  selectedEntry: LibraryEntry | null
  setDrafts: Dispatch<SetStateAction<Record<string, EntryDraft>>>
  setSelectedEntryMetadata: Dispatch<SetStateAction<MetadataCard | null>>
  setSnapshot: Dispatch<SetStateAction<WatchLogSnapshot>>
  setStatusMessageState: Dispatch<SetStateAction<LibraryStatusMessageState>>
  t: I18nValue['t']
}

export function useEntryAniListRefresh({
  selectedCatalogId,
  selectedDraft,
  selectedEntry,
  setDrafts,
  setSelectedEntryMetadata,
  setSnapshot,
  setStatusMessageState,
  t,
}: UseEntryAniListRefreshParams) {
  const [isEntryAniListRefreshing, setIsEntryAniListRefreshing] = useState(false)

  async function handleRefreshEntryAniList(): Promise<void> {
    if (!selectedEntry || !selectedDraft || isEntryAniListRefreshing) {
      console.warn('[WatchLog][AniListRefresh] Refresh ignored', {
        hasSelectedEntry: Boolean(selectedEntry),
        hasSelectedDraft: Boolean(selectedDraft),
        isEntryAniListRefreshing,
      })
      return
    }

    if (!['anime', 'manga', 'manhwa', 'manhua'].includes(selectedDraft.mediaType)) {
      console.warn('[WatchLog][AniListRefresh] Refresh blocked by media type', {
        catalogId: selectedEntry.catalog.id,
        title: selectedEntry.catalog.title,
        mediaType: selectedDraft.mediaType,
      })
      setStatusMessageState({
        key: 'library.errorWithReason',
        params: {
          reason: t('library.syncReasonUnsupportedType', {
            type: getLocalizedMediaTypeLabel(selectedDraft.mediaType, t),
          }),
        },
      })
      return
    }

    const catalogId = selectedEntry.catalog.id
    console.info('[WatchLog][AniListRefresh] Button pressed', {
      catalogId,
      title: selectedEntry.catalog.title,
      normalizedTitle: selectedEntry.catalog.normalizedTitle,
      mediaType: selectedDraft.mediaType,
      currentAniListId: selectedEntry.catalog.externalIds.anilist ?? null,
      currentMangaDexId: selectedEntry.catalog.externalIds.mangadex ?? null,
    })

    setIsEntryAniListRefreshing(true)
    setStatusMessageState({ key: 'library.anilistRefreshRunning' })

    try {
      const detection = { ...buildDetectionForCatalogSync(selectedEntry), mediaType: selectedDraft.mediaType }
      console.info('[WatchLog][AniListRefresh] Detection payload', detection)
      const metadata = await refreshAniListMetadata(detection)

      if (!metadata) {
        console.warn('[WatchLog][AniListRefresh] No metadata found', { catalogId, title: selectedEntry.catalog.title })
        setStatusMessageState({ key: 'library.anilistRefreshNoMatch' })
        return
      }

      const response = await updateEntry({ catalogId, metadataRefresh: metadata })
      console.info('[WatchLog][AniListRefresh] Entry updated', {
        catalogId,
        persistedCatalogId: response.entry?.catalog.id ?? null,
        persistedAniListId: response.entry?.catalog.externalIds.anilist ?? null,
      })
      setSnapshot(response.snapshot)
      const persistedEntry = response.entry
      if (persistedEntry) {
        setDrafts((current) => ({ ...current, [persistedEntry.catalog.id]: createEntryDraft(persistedEntry) }))
      }
      if (selectedCatalogId === catalogId) {
        setSelectedEntryMetadata(metadata)
      }
      setStatusMessageState({ key: 'library.anilistRefreshDone' })
    } catch (error) {
      console.error('[WatchLog][AniListRefresh] Refresh failed', { catalogId, title: selectedEntry.catalog.title, error })
      setStatusMessageState({
        key: 'library.errorWithReason',
        params: {
          reason: t('library.syncReasonRequestFailed', {
            reason: error instanceof Error ? error.message : 'anilist-refresh-failed',
          }),
        },
      })
    } finally {
      setIsEntryAniListRefreshing(false)
    }
  }

  return {
    isEntryAniListRefreshing,
    handleRefreshEntryAniList,
  }
}
