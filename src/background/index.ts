import { MockMetadataProvider } from '../shared/metadata/mock-provider'
import type {
  AddListResponse,
  ExplorerResponse,
  ExportActivityResponse,
  ExportCatalogResponse,
  LibraryResponse,
  SaveDetectionResponse,
  UpdateEntryResponse,
  WatchLogMessage,
} from '../shared/messages'
import { STORAGE_KEYS } from '../shared/constants'
import { LocalStorageProvider } from '../shared/storage/local-storage-provider'
import { storageGet, storageSet, getActiveTab } from '../shared/storage/browser'
import { WatchLogRepository } from '../shared/storage/repository'
import type { DetectionResult } from '../shared/types'

const metadataProvider = new MockMetadataProvider()
const repository = new WatchLogRepository(
  new LocalStorageProvider(),
  metadataProvider,
)

async function getDetectionMap(): Promise<Record<string, DetectionResult>> {
  return storageGet<Record<string, DetectionResult>>(
    chrome.storage.session,
    STORAGE_KEYS.detectionByTab,
    {},
  )
}

async function setDetection(tabId: number, detection: DetectionResult): Promise<void> {
  const map = await getDetectionMap()
  map[String(tabId)] = detection
  await storageSet(chrome.storage.session, STORAGE_KEYS.detectionByTab, map)
}

async function removeDetection(tabId: number): Promise<void> {
  const map = await getDetectionMap()
  delete map[String(tabId)]
  await storageSet(chrome.storage.session, STORAGE_KEYS.detectionByTab, map)
}

chrome.runtime.onInstalled.addListener(() => {
  void repository.getSnapshot()
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
})

chrome.runtime.onStartup.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
})

chrome.tabs.onRemoved.addListener((tabId) => {
  void removeDetection(tabId)
})

chrome.runtime.onMessage.addListener((message: WatchLogMessage, sender, sendResponse) => {
  const respond = async () => {
    switch (message.type) {
      case 'watchlog/report-detection': {
        if (sender.tab?.id !== undefined) {
          await setDetection(sender.tab.id, message.payload)
        }
        sendResponse({ ok: true })
        return
      }
      case 'watchlog/get-active-detection': {
        const tab = await getActiveTab()
        const map = await getDetectionMap()
        sendResponse({
          detection: tab?.id !== undefined ? map[String(tab.id)] ?? null : null,
        })
        return
      }
      case 'watchlog/save-detection': {
        const response: SaveDetectionResponse = await repository.saveDetection(message.payload)
        sendResponse(response)
        return
      }
      case 'watchlog/add-from-explorer': {
        const item = await metadataProvider.getById(message.payload.metadataId)
        if (!item) {
          throw new Error('Explorer item not found.')
        }

        const response: SaveDetectionResponse = await repository.addFromMetadata(
          item,
          message.payload.listId,
        )
        sendResponse(response)
        return
      }
      case 'watchlog/get-library': {
        const response: LibraryResponse = {
          snapshot: await repository.getSnapshot(),
        }
        sendResponse(response)
        return
      }
      case 'watchlog/get-explorer': {
        const response: ExplorerResponse = {
          items: await repository.getExplorer(message.payload?.query),
        }
        sendResponse(response)
        return
      }
      case 'watchlog/update-entry': {
        const response: UpdateEntryResponse = await repository.updateEntry(message.payload)
        sendResponse(response)
        return
      }
      case 'watchlog/add-list': {
        const response: AddListResponse = await repository.addList(message.payload.label)
        sendResponse(response)
        return
      }
      case 'watchlog/export-catalog': {
        const response: ExportCatalogResponse = {
          payload: await repository.exportCatalog(),
        }
        sendResponse(response)
        return
      }
      case 'watchlog/export-activity': {
        const response: ExportActivityResponse = {
          payload: await repository.exportActivity(),
        }
        sendResponse(response)
        return
      }
      case 'watchlog/import-backup': {
        const snapshot = await repository.importBackup(
          message.payload.catalog,
          message.payload.activity,
        )
        const response: LibraryResponse = { snapshot }
        sendResponse(response)
        return
      }
      default:
        sendResponse({ error: 'Unsupported message.' })
    }
  }

  void respond().catch((error: unknown) => {
    sendResponse({
      error: error instanceof Error ? error.message : 'Unexpected runtime error.',
    })
  })

  return true
})
