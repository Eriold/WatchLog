import type { StorageProvider } from '../../../shared/storage/provider'
import type { WatchListDefinition, WatchLogSnapshot } from '../../../shared/types'
import { nowIso } from '../../../shared/utils/time'

export class ListRepository {
  private readonly storageProvider: StorageProvider

  constructor(storageProvider: StorageProvider) {
    this.storageProvider = storageProvider
  }

  async addList(label: string): Promise<{ list: WatchListDefinition; snapshot: WatchLogSnapshot }> {
    const list = await this.storageProvider.addCustomList(label)
    const snapshot = await this.storageProvider.getSnapshot()

    return {
      list,
      snapshot,
    }
  }

  removeList(
    snapshot: WatchLogSnapshot,
    listId: string,
    fallbackListId: string,
  ): { snapshot: WatchLogSnapshot; removedListId: string; fallbackListId: string } {
    const targetList = snapshot.lists.find((list) => list.id === listId)

    if (!targetList) {
      throw new Error('List not found.')
    }

    if (targetList.kind !== 'custom') {
      throw new Error('System lists cannot be removed.')
    }

    return {
      removedListId: listId,
      fallbackListId,
      snapshot: {
        ...snapshot,
        lists: snapshot.lists.filter((list) => list.id !== listId),
      },
    }
  }

  updateList(
    snapshot: WatchLogSnapshot,
    listId: string,
    label: string,
  ): { list: WatchListDefinition; snapshot: WatchLogSnapshot } {
    const targetList = snapshot.lists.find((list) => list.id === listId)

    if (!targetList) {
      throw new Error('List not found.')
    }

    if (targetList.kind !== 'custom') {
      throw new Error('System lists cannot be renamed.')
    }

    const trimmedLabel = label.trim()
    if (!trimmedLabel) {
      throw new Error('List label cannot be empty.')
    }

    const updatedList: WatchListDefinition = {
      ...targetList,
      label: trimmedLabel,
      updatedAt: nowIso(),
    }

    return {
      list: updatedList,
      snapshot: {
        ...snapshot,
        lists: snapshot.lists.map((list) => (list.id === listId ? updatedList : list)),
      },
    }
  }
}
