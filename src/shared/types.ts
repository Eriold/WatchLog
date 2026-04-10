export type MediaType =
  | 'movie'
  | 'series'
  | 'anime'
  | 'manga'
  | 'manhwa'
  | 'manhua'
  | 'novel'
  | 'video'
  | 'unknown'

export type ListKind = 'system' | 'custom'

export type PublicationStatus =
  | 'FINISHED'
  | 'RELEASING'
  | 'NOT_YET_RELEASED'
  | 'CANCELLED'
  | 'HIATUS'

export type PosterKind = 'official' | 'unofficial' | 'temporary'
export type MetadataSyncStatus = 'pending' | 'synced'

export interface FuzzyDate {
  year?: number
  month?: number
  day?: number
}

export interface WatchListDefinition {
  id: string
  label: string
  kind: ListKind
  description?: string
  createdAt?: string
  updatedAt?: string
}

export interface ProgressState {
  season?: number
  episode?: number
  episodeTotal?: number
  chapter?: number
  chapterTotal?: number
  part?: number
  progressText: string
}

export interface SourceHistoryEntry {
  id: string
  siteName: string
  url: string
  favicon: string
  pageTitle: string
  detectedAt: string
  progressText: string
  season?: number
  episode?: number
  episodeTotal?: number
  chapter?: number
  chapterTotal?: number
}

export interface CatalogEntry {
  id: string
  title: string
  normalizedTitle: string
  aliases?: string[]
  seasonNumber?: number
  mediaType: MediaType
  metadataSyncStatus?: MetadataSyncStatus
  score?: number
  poster?: string
  posterKind?: PosterKind
  backdrop?: string
  genres: string[]
  description?: string
  publicationStatus?: PublicationStatus
  startDate?: FuzzyDate
  endDate?: FuzzyDate
  releaseYear?: number
  runtime?: number
  seasonCount?: number
  episodeCount?: number
  chapterCount?: number
  externalIds: Record<string, string>
  createdAt: string
  updatedAt: string
}

export interface ActivityEntry {
  catalogId: string
  status: string
  favorite: boolean
  currentProgress: ProgressState
  lastSource?: SourceHistoryEntry
  sourceHistory: SourceHistoryEntry[]
  manualNotes: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface DetectionResult {
  title: string
  normalizedTitle: string
  mediaType: MediaType
  sourceSite: string
  url: string
  favicon: string
  pageTitle: string
  season?: number
  episode?: number
  episodeTotal?: number
  chapter?: number
  chapterTotal?: number
  progressLabel: string
  confidence: number
}

export interface DetectionContext {
  url: URL
  title: string
  document: Document
  bodyText: string
}

export interface DetectionAdapter {
  id: string
  siteName: string
  matches(url: URL): boolean
  detect(context: DetectionContext): DetectionResult | null
}

export interface MetadataCard {
  id: string
  title: string
  normalizedTitle: string
  aliases?: string[]
  seasonNumber?: number
  mediaType: MediaType
  poster?: string
  backdrop?: string
  genres: string[]
  description: string
  publicationStatus?: PublicationStatus
  startDate?: FuzzyDate
  endDate?: FuzzyDate
  releaseYear?: number
  runtime?: number
  seasonCount?: number
  episodeCount?: number
  chapterCount?: number
  score?: number
}

export interface WatchLogSnapshot {
  catalog: CatalogEntry[]
  activity: ActivityEntry[]
  lists: WatchListDefinition[]
}

export interface LibraryEntry {
  catalog: CatalogEntry
  activity: ActivityEntry
}

export interface SaveDetectionInput {
  detection: DetectionResult
  listId: string
  favorite?: boolean
  metadata?: MetadataCard
  posterOverride?: string
  metadataSyncStatus?: MetadataSyncStatus
  skipMetadataLookup?: boolean
  disableTemporaryPoster?: boolean
}

export interface UpdateEntryInput {
  catalogId: string
  title?: string
  mediaType?: MediaType
  listId?: string
  favorite?: boolean
  manualNotes?: string
  progress?: Partial<ProgressState>
  metadataRefresh?: MetadataCard
}

export interface ExportCatalogPayload {
  schemaVersion: 1
  exportedAt: string
  catalog: CatalogEntry[]
}

export interface ExportActivityPayload {
  schemaVersion: 1
  exportedAt: string
  lists: WatchListDefinition[]
  activity: ActivityEntry[]
}

export interface WatchLogExportBundle {
  catalog: ExportCatalogPayload
  activity: ExportActivityPayload
}
