import type {
  ExportActivityPayload,
  ExportCatalogPayload,
  WatchListDefinition,
  WatchLogSnapshot,
} from '../types'

export interface StorageProvider {
  getSnapshot(): Promise<WatchLogSnapshot>
  saveSnapshot(snapshot: WatchLogSnapshot): Promise<void>
  addCustomList(label: string): Promise<WatchListDefinition>
  exportCatalog(): Promise<ExportCatalogPayload>
  exportActivity(): Promise<ExportActivityPayload>
  importBackup(
    catalogPayload: ExportCatalogPayload,
    activityPayload: ExportActivityPayload,
  ): Promise<WatchLogSnapshot>
}
