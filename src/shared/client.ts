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
import { MockMetadataProvider } from './metadata/mock-provider'
import { LocalStorageProvider } from './storage/local-storage-provider'
import { WatchLogRepository } from './storage/repository'
import type {
  ExportActivityPayload,
  ExportCatalogPayload,
  SaveDetectionInput,
  UpdateEntryInput,
} from './types'
import { sendRuntimeMessage } from './storage/browser'

const metadataProvider = new MockMetadataProvider()
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

export async function addList(label: string) {
  return repository.addList(label) as Promise<AddListResponse>
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
