import { STORAGE_KEYS, SYSTEM_LISTS } from '../constants'
import type {
  ActivityEntry,
  CatalogEntry,
  ExportActivityPayload,
  ExportCatalogPayload,
  WatchListDefinition,
  WatchLogSnapshot,
} from '../types'
import { slugify } from '../utils/normalize'
import { nowIso } from '../utils/time'
import { storageGet, storageSet } from './browser'
import type { StorageProvider } from './provider'

function mergeLists(lists: WatchListDefinition[]): WatchListDefinition[] {
  const map = new Map<string, WatchListDefinition>()

  for (const list of SYSTEM_LISTS) {
    map.set(list.id, { ...list })
  }

  for (const list of lists) {
    if (!map.has(list.id)) {
      map.set(list.id, list)
    }
  }

  return Array.from(map.values())
}

async function readCatalog(): Promise<CatalogEntry[]> {
  return storageGet<CatalogEntry[]>(chrome.storage.local, STORAGE_KEYS.catalog, [])
}

async function readActivity(): Promise<ActivityEntry[]> {
  return storageGet<ActivityEntry[]>(chrome.storage.local, STORAGE_KEYS.activity, [])
}

async function readLists(): Promise<WatchListDefinition[]> {
  const stored = await storageGet<WatchListDefinition[]>(chrome.storage.local, STORAGE_KEYS.lists, [])
  return mergeLists(stored)
}

async function writeLists(lists: WatchListDefinition[]): Promise<void> {
  await storageSet(chrome.storage.local, STORAGE_KEYS.lists, mergeLists(lists))
}

export class LocalStorageProvider implements StorageProvider {
  async getSnapshot(): Promise<WatchLogSnapshot> {
    const [catalog, activity, lists] = await Promise.all([
      readCatalog(),
      readActivity(),
      readLists(),
    ])

    console.log('[WatchLog] localStorageProvider:getSnapshot', {
      catalogCount: catalog.length,
      activityCount: activity.length,
      lists,
    })

    return { catalog, activity, lists }
  }

  async saveSnapshot(snapshot: WatchLogSnapshot): Promise<void> {
    await Promise.all([
      storageSet(chrome.storage.local, STORAGE_KEYS.catalog, snapshot.catalog),
      storageSet(chrome.storage.local, STORAGE_KEYS.activity, snapshot.activity),
      writeLists(snapshot.lists),
    ])
  }

  async addCustomList(label: string): Promise<WatchListDefinition> {
    const lists = await readLists()
    const trimmedLabel = label.trim()
    console.log('[WatchLog] addCustomList:before', {
      label,
      trimmedLabel,
      lists,
    })

    if (!trimmedLabel) {
      throw new Error('List label cannot be empty.')
    }

    const baseId = slugify(trimmedLabel) || 'lista'
    let uniqueId = baseId
    let counter = 2

    while (lists.some((list) => list.id === uniqueId)) {
      uniqueId = `${baseId}-${counter}`
      counter += 1
    }

    const timestamp = nowIso()
    const list: WatchListDefinition = {
      id: uniqueId,
      label: trimmedLabel,
      kind: 'custom',
      description: 'User-defined collection.',
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    await writeLists([...lists, list])
    const persistedLists = await readLists()
    console.log('[WatchLog] addCustomList:after', {
      createdList: list,
      persistedLists,
    })
    return list
  }

  async exportCatalog(): Promise<ExportCatalogPayload> {
    return {
      schemaVersion: 1,
      exportedAt: nowIso(),
      catalog: await readCatalog(),
    }
  }

  async exportActivity(): Promise<ExportActivityPayload> {
    return {
      schemaVersion: 1,
      exportedAt: nowIso(),
      lists: await readLists(),
      activity: await readActivity(),
    }
  }

  async importBackup(
    catalogPayload: ExportCatalogPayload,
    activityPayload: ExportActivityPayload,
  ): Promise<WatchLogSnapshot> {
    const snapshot: WatchLogSnapshot = {
      catalog: catalogPayload.catalog,
      activity: activityPayload.activity,
      lists: mergeLists(activityPayload.lists),
    }

    await this.saveSnapshot(snapshot)
    return snapshot
  }
}
