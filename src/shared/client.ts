import type {
  ActiveDetectionResponse,
  AddListResponse,
  ExplorerResponse,
  ExportActivityResponse,
  ExportCatalogResponse,
  LibraryResponse,
  SaveDetectionResponse,
  UpdateEntryResponse,
  WatchLogMessage,
} from './messages'
import type {
  ExportActivityPayload,
  ExportCatalogPayload,
  SaveDetectionInput,
  UpdateEntryInput,
} from './types'
import { sendRuntimeMessage } from './storage/browser'

export async function getActiveDetection() {
  return sendRuntimeMessage<ActiveDetectionResponse>({
    type: 'watchlog/get-active-detection',
  } satisfies WatchLogMessage)
}

export async function saveDetection(payload: SaveDetectionInput) {
  return sendRuntimeMessage<SaveDetectionResponse>({
    type: 'watchlog/save-detection',
    payload,
  } satisfies WatchLogMessage)
}

export async function addFromExplorer(metadataId: string, listId: string) {
  return sendRuntimeMessage<SaveDetectionResponse>({
    type: 'watchlog/add-from-explorer',
    payload: { metadataId, listId },
  } satisfies WatchLogMessage)
}

export async function getLibrary() {
  return sendRuntimeMessage<LibraryResponse>({
    type: 'watchlog/get-library',
  } satisfies WatchLogMessage)
}

export async function getExplorer(query?: string) {
  return sendRuntimeMessage<ExplorerResponse>({
    type: 'watchlog/get-explorer',
    payload: { query },
  } satisfies WatchLogMessage)
}

export async function updateEntry(payload: UpdateEntryInput) {
  return sendRuntimeMessage<UpdateEntryResponse>({
    type: 'watchlog/update-entry',
    payload,
  } satisfies WatchLogMessage)
}

export async function addList(label: string) {
  return sendRuntimeMessage<AddListResponse>({
    type: 'watchlog/add-list',
    payload: { label },
  } satisfies WatchLogMessage)
}

export async function exportCatalog() {
  return sendRuntimeMessage<ExportCatalogResponse>({
    type: 'watchlog/export-catalog',
  } satisfies WatchLogMessage)
}

export async function exportActivity() {
  return sendRuntimeMessage<ExportActivityResponse>({
    type: 'watchlog/export-activity',
  } satisfies WatchLogMessage)
}

export async function importBackup(
  catalog: ExportCatalogPayload,
  activity: ExportActivityPayload,
) {
  return sendRuntimeMessage<LibraryResponse>({
    type: 'watchlog/import-backup',
    payload: { catalog, activity },
  } satisfies WatchLogMessage)
}
