import type {
  CatalogEntry,
  DetectionResult,
  LibraryEntry,
  MediaType,
  MetadataCard,
  ProgressState,
} from './types'

const SEASON_PATTERNS = [
  /\bseason\s*(\d+)\b/i,
  /\b(\d+)(?:st|nd|rd|th)\s+season\b/i,
  /\btemporada\s*(\d+)\b/i,
  /\bpart\s*(\d+)\b/i,
  /\bparte\s*(\d+)\b/i,
]

function parseSeasonFromText(value?: string): number | undefined {
  const text = value?.trim()
  if (!text) {
    return undefined
  }

  for (const pattern of SEASON_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      return Number(match[1])
    }
  }

  const trailingNumberMatch = text.match(/(?:^|[\s:!.,\-])(\d+)\s*$/)
  if (trailingNumberMatch) {
    return Number(trailingNumberMatch[1])
  }

  return undefined
}

export function inferSeasonNumberFromTitles(values: Array<string | undefined>): number | undefined {
  for (const value of values) {
    const seasonNumber = parseSeasonFromText(value)
    if (seasonNumber !== undefined) {
      return seasonNumber
    }
  }

  return undefined
}

function shouldDefaultToSeasonOne(
  mediaType: MediaType | undefined,
  hasEpisodicSignal: boolean,
): boolean {
  return hasEpisodicSignal && (mediaType === 'anime' || mediaType === 'series')
}

export function getMetadataSeasonNumber(
  metadata: {
    seasonNumber?: MetadataCard['seasonNumber']
    title: MetadataCard['title']
    aliases?: MetadataCard['aliases']
    mediaType?: MetadataCard['mediaType']
    episodeCount?: MetadataCard['episodeCount']
    seasonCount?: MetadataCard['seasonCount']
  },
): number | undefined {
  const inferred =
    metadata.seasonNumber ??
    inferSeasonNumberFromTitles([metadata.title, ...(metadata.aliases ?? [])])

  if (inferred !== undefined) {
    return inferred
  }

  return shouldDefaultToSeasonOne(
    metadata.mediaType,
    metadata.episodeCount !== undefined || metadata.seasonCount !== undefined,
  )
    ? 1
    : undefined
}

export function getDetectionSeasonNumber(
  detection: {
    season?: DetectionResult['season']
    title: DetectionResult['title']
    mediaType?: DetectionResult['mediaType']
    episode?: DetectionResult['episode']
    episodeTotal?: DetectionResult['episodeTotal']
  },
): number | undefined {
  const inferred = detection.season ?? inferSeasonNumberFromTitles([detection.title])

  if (inferred !== undefined) {
    return inferred
  }

  return shouldDefaultToSeasonOne(
    detection.mediaType,
    detection.episode !== undefined || detection.episodeTotal !== undefined,
  )
    ? 1
    : undefined
}

export function getCatalogSeasonNumber(
  catalog: {
    seasonNumber?: CatalogEntry['seasonNumber']
    title: CatalogEntry['title']
    aliases?: CatalogEntry['aliases']
    mediaType?: CatalogEntry['mediaType']
    episodeCount?: CatalogEntry['episodeCount']
    seasonCount?: CatalogEntry['seasonCount']
  },
): number | undefined {
  const inferred =
    catalog.seasonNumber ??
    inferSeasonNumberFromTitles([catalog.title, ...(catalog.aliases ?? [])])

  if (inferred !== undefined) {
    return inferred
  }

  return shouldDefaultToSeasonOne(
    catalog.mediaType,
    catalog.episodeCount !== undefined || catalog.seasonCount !== undefined,
  )
    ? 1
    : undefined
}

export function getProgressSeasonNumber(progress: Pick<ProgressState, 'season'>): number | undefined {
  return progress.season
}

export function getLibraryEntrySeasonNumber(entry: LibraryEntry): number | undefined {
  return (
    getCatalogSeasonNumber(entry.catalog) ??
    getProgressSeasonNumber(entry.activity.currentProgress) ??
    entry.activity.lastSource?.season
  )
}

export function areSeasonNumbersCompatible(
  left: number | undefined,
  right: number | undefined,
): boolean {
  return left === undefined || right === undefined || left === right
}

export function getCardSeasonCountBadge(
  seasonNumber?: number,
  episodeCount?: number,
  chapterCount?: number,
): string | null {
  const parts: string[] = []

  if (seasonNumber !== undefined) {
    parts.push(`S${seasonNumber}`)
  }

  const count = episodeCount ?? chapterCount
  if (count !== undefined) {
    parts.push(`C${count}`)
  }

  return parts.length > 0 ? parts.join(' ') : null
}
