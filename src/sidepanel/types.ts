/** Contains sidepanel-specific state types shared by hooks and presentational components. */
import type { MediaType } from '../shared/types'

export type EntryDraft = {
  title: string
  mediaType: MediaType
  notes: string
  progressText: string
  progressValue: number | null
  listId: string
  favorite: boolean
}

export type InitialLibrarySelection = {
  viewId: string
  catalogId: string | null
  query: string
}

export type NavGlyphKind = 'library' | 'watching' | 'completed' | 'favorites' | 'explorer'

export type ListModalState =
  | {
    mode: 'clear'
    listId: string
    label: string
    input: string
  }
  | {
    mode: 'delete'
    listId: string
    label: string
    input: string
  }

export type EntryDeleteState = {
  catalogId: string
  title: string
}

export type CatalogSyncFailure = {
  title: string
  reason: string
}

export type CatalogSyncSummary = {
  total: number
  resolvedTitles: string[]
  failedItems: CatalogSyncFailure[]
}

export type CatalogSyncVisualState = 'synced' | 'pending' | 'syncing'

export type LibraryStatusMessageState = {
  key:
    | 'library.loading'
    | 'library.ready'
    | 'library.listCreated'
    | 'library.listUpdated'
    | 'library.listDeleted'
    | 'library.listCleared'
    | 'library.listCreateFailed'
    | 'library.errorWithReason'
    | 'library.entryUpdated'
    | 'library.entryDeleted'
    | 'library.explorerRefreshed'
    | 'library.addedToList'
    | 'library.anilistRefreshRunning'
    | 'library.anilistRefreshDone'
    | 'library.anilistRefreshNoMatch'
  params?: Record<string, string>
}
