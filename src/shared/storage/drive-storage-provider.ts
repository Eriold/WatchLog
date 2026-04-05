import type {
  ExportActivityPayload,
  ExportCatalogPayload,
  WatchListDefinition,
  WatchLogSnapshot,
} from '../types'
import type { StorageProvider } from './provider'

export class DriveStorageProvider implements StorageProvider {
  async getSnapshot(): Promise<WatchLogSnapshot> {
    throw new Error('DriveStorageProvider is reserved for phase 2.')
  }

  async saveSnapshot(snapshot: WatchLogSnapshot): Promise<void> {
    void snapshot
    throw new Error('DriveStorageProvider is reserved for phase 2.')
  }

  async addCustomList(label: string): Promise<WatchListDefinition> {
    void label
    throw new Error('DriveStorageProvider is reserved for phase 2.')
  }

  async exportCatalog(): Promise<ExportCatalogPayload> {
    throw new Error('DriveStorageProvider is reserved for phase 2.')
  }

  async exportActivity(): Promise<ExportActivityPayload> {
    throw new Error('DriveStorageProvider is reserved for phase 2.')
  }

  async importBackup(
    catalogPayload: ExportCatalogPayload,
    activityPayload: ExportActivityPayload,
  ): Promise<WatchLogSnapshot> {
    void catalogPayload
    void activityPayload
    throw new Error('DriveStorageProvider is reserved for phase 2.')
  }
}
