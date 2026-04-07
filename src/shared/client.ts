import type {
  ActiveDetectionResponse,
  AddListResponse,
  ClearListResponse,
  ExplorerResponse,
  ExportActivityResponse,
  ExportCatalogResponse,
  LibraryResponse,
  RemoveEntryResponse,
  RemoveListResponse,
  SaveDetectionResponse,
  UpdateListResponse,
  UpdateEntryResponse,
  WatchLogMessage,
} from './messages'
import { createMetadataProvider } from './metadata/create-provider'
import { LocalStorageProvider } from './storage/local-storage-provider'
import { WatchLogRepository } from './storage/repository'
import type {
  ExportActivityPayload,
  ExportCatalogPayload,
  SaveDetectionInput,
  UpdateEntryInput,
} from './types'
import { sendRuntimeMessage } from './storage/browser'

const metadataProvider = createMetadataProvider()
const repository = new WatchLogRepository(new LocalStorageProvider(), metadataProvider)

export async function getActiveDetection(tabId?: number) {
  return sendRuntimeMessage<ActiveDetectionResponse>({
    type: 'watchlog/get-active-detection',
    payload: { tabId },
  } satisfies WatchLogMessage)
}

export async function reanalyzeActiveDetection(tabId?: number) {
  return sendRuntimeMessage<ActiveDetectionResponse>({
    type: 'watchlog/reanalyze-active-detection',
    payload: { tabId },
  } satisfies WatchLogMessage)
}

export async function saveDetection(payload: SaveDetectionInput) {
  return repository.saveDetection(payload) as Promise<SaveDetectionResponse>
}

export async function addFromExplorer(metadataId: string, listId: string) {
  const item = await metadataProvider.getById(metadataId)

  if (!item) {
    throw new Error('Explorer item not found.')
  }

  return repository.addFromMetadata(item, listId) as Promise<SaveDetectionResponse>
}

export async function getLibrary() {
  return {
    snapshot: await repository.getSnapshot(),
  } satisfies LibraryResponse
}

export async function getExplorer(query?: string) {
  return {
    items: await repository.getExplorer(query),
  } satisfies ExplorerResponse
}

export async function updateEntry(payload: UpdateEntryInput) {
  return repository.updateEntry(payload) as Promise<UpdateEntryResponse>
}

export async function removeEntry(catalogId: string) {
  return repository.removeEntry(catalogId) as Promise<RemoveEntryResponse>
}

export async function addList(label: string) {
  return repository.addList(label) as Promise<AddListResponse>
}

export async function removeList(listId: string) {
  return repository.removeList(listId) as Promise<RemoveListResponse>
}

export async function updateList(listId: string, label: string) {
  return repository.updateList(listId, label) as Promise<UpdateListResponse>
}

export async function clearList(listId: string) {
  return repository.clearList(listId) as Promise<ClearListResponse>
}

export async function exportCatalog() {
  return {
    payload: await repository.exportCatalog(),
  } satisfies ExportCatalogResponse
}

export async function exportActivity() {
  return {
    payload: await repository.exportActivity(),
  } satisfies ExportActivityResponse
}

export async function importBackup(
  catalog: ExportCatalogPayload,
  activity: ExportActivityPayload,
) {
  return {
    snapshot: await repository.importBackup(catalog, activity),
  } satisfies LibraryResponse
}
