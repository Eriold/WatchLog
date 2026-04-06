import type {
  DetectionResult,
  ExportActivityPayload,
  ExportCatalogPayload,
  LibraryEntry,
  MetadataCard,
  SaveDetectionInput,
  UpdateEntryInput,
  WatchListDefinition,
  WatchLogSnapshot,
} from './types'

export type WatchLogMessage =
  | { type: 'watchlog/report-detection'; payload: DetectionResult }
  | { type: 'watchlog/get-active-detection'; payload?: { tabId?: number } }
  | { type: 'watchlog/reanalyze-active-detection'; payload?: { tabId?: number } }
  | { type: 'watchlog/request-live-detection' }
  | { type: 'watchlog/save-detection'; payload: SaveDetectionInput }
  | { type: 'watchlog/add-from-explorer'; payload: { metadataId: string; listId: string } }
  | { type: 'watchlog/get-library' }
  | { type: 'watchlog/get-explorer'; payload?: { query?: string } }
  | { type: 'watchlog/update-entry'; payload: UpdateEntryInput }
  | { type: 'watchlog/add-list'; payload: { label: string } }
  | { type: 'watchlog/remove-list'; payload: { listId: string } }
  | { type: 'watchlog/export-catalog' }
  | { type: 'watchlog/export-activity' }
  | {
      type: 'watchlog/import-backup'
      payload: {
        catalog: ExportCatalogPayload
        activity: ExportActivityPayload
      }
    }

export interface DetectionDebugInfo {
  tabId: number | null
  tabUrl: string | null
  source: 'cache' | 'content-script' | 'scripting' | 'popup-scripting' | 'none'
  reason?: string
}

export interface ActiveDetectionResponse {
  detection: DetectionResult | null
  debug: DetectionDebugInfo
}

export interface SaveDetectionResponse {
  entry: LibraryEntry
  snapshot: WatchLogSnapshot
}

export interface LibraryResponse {
  snapshot: WatchLogSnapshot
}

export interface ExplorerResponse {
  items: MetadataCard[]
}

export interface AddListResponse {
  list: WatchListDefinition
  snapshot: WatchLogSnapshot
}

export interface RemoveListResponse {
  removedListId: string
  fallbackListId: string
  snapshot: WatchLogSnapshot
}

export interface UpdateListResponse {
  list: WatchListDefinition
  snapshot: WatchLogSnapshot
}

export interface ClearListResponse {
  clearedListId: string
  removedCatalogIds: string[]
  snapshot: WatchLogSnapshot
}

export interface UpdateEntryResponse {
  entry: LibraryEntry | null
  snapshot: WatchLogSnapshot
}

export interface ExportCatalogResponse {
  payload: ExportCatalogPayload
}

export interface ExportActivityResponse {
  payload: ExportActivityPayload
}
