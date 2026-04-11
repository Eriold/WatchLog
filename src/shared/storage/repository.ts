import type { MetadataProvider } from '../metadata/provider'
import type { StorageProvider } from './provider'
import { WatchLogLibraryService } from '../../domains/library/services/watchlog-library-service'

export class WatchLogRepository extends WatchLogLibraryService {
  constructor(storageProvider: StorageProvider, metadataProvider: MetadataProvider) {
    super(storageProvider, metadataProvider)
  }
}
