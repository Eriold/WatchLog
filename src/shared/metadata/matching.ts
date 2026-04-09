import type { CatalogEntry, DetectionResult, MediaType, MetadataCard } from '../types'
import {
  areSeasonNumbersCompatible,
  getDetectionSeasonNumber,
  getMetadataSeasonNumber,
} from '../season'
import { normalizeTitle } from '../utils/normalize'

const ANIME_HINT_PATTERN =
  /\b(?:anime|jkanime|animeflv|animeav1|crunchyroll|hidive|otaku|otakudesu|animesaturn|aniwatch)\b/i
const MANGA_HINT_PATTERN =
  /\b(?:manga|manhwa|manhua|webtoon|lectormanga|lectortmo|mangadex|manganato|asurascans|shadowmanga|inmanga)\b/i
const NOVEL_HINT_PATTERN = /\b(?:novel|ranobe|light\s*novel|web\s*novel)\b/i

function uniqueNormalizedTitles(values: Array<string | undefined>): string[] {
  const seen = new Set<string>()
  const items: string[] = []

  for (const value of values) {
    if (!value) {
      continue
    }

    const normalized = normalizeTitle(value)
    if (!normalized || seen.has(normalized)) {
      continue
    }

    seen.add(normalized)
    items.push(normalized)
  }

  return items
}

function uniqueDisplayTitles(values: Array<string | undefined>, primaryTitle?: string): string[] {
  const normalizedPrimary = primaryTitle ? normalizeTitle(primaryTitle) : ''
  const seen = new Set<string>()
  const items: string[] = []

  for (const value of values) {
    const trimmed = value?.trim()
    if (!trimmed) {
      continue
    }

    const normalized = normalizeTitle(trimmed)
    if (!normalized || normalized === normalizedPrimary || seen.has(normalized)) {
      continue
    }

    seen.add(normalized)
    items.push(trimmed)
  }

  return items
}

export function getMetadataNormalizedTitles(item: MetadataCard): string[] {
  return uniqueNormalizedTitles([item.title, ...(item.aliases ?? [])])
}

export function getCatalogNormalizedTitles(item: CatalogEntry): string[] {
  return uniqueNormalizedTitles([item.title, item.normalizedTitle, ...(item.aliases ?? [])])
}

export function mergeAlternativeTitles(
  primaryTitle: string,
  values: Array<string | undefined>,
): string[] {
  return uniqueDisplayTitles(values, primaryTitle)
}

export function areMediaTypesCompatible(left: MediaType, right: MediaType): boolean {
  if (left === right) {
    return true
  }

  const compatibilityPairs: Array<[MediaType, MediaType]> = [
    ['anime', 'series'],
    ['series', 'anime'],
    ['novel', 'manga'],
    ['manga', 'novel'],
  ]

  return compatibilityPairs.some(([source, target]) => source === left && target === right)
}

export function hasNormalizedTitleOverlap(left: string[], right: string[]): boolean {
  return left.some((leftTitle) =>
    right.some((rightTitle) => {
      return (
        leftTitle === rightTitle ||
        leftTitle.includes(rightTitle) ||
        rightTitle.includes(leftTitle)
      )
    }),
  )
}

export function getMetadataExternalIds(item?: Pick<MetadataCard, 'id'> | null): Record<string, string> {
  if (!item?.id) {
    return {}
  }

  if (item.id.startsWith('anilist:')) {
    return {
      anilist: item.id.slice('anilist:'.length),
    }
  }

  return {}
}

function collectDetectionHintText(detection: Pick<DetectionResult, 'sourceSite' | 'url'>): string {
  return `${detection.sourceSite} ${detection.url}`.toLowerCase()
}

export function getDetectionMediaTypeHints(
  detection: Pick<
    DetectionResult,
    'mediaType' | 'sourceSite' | 'url' | 'episode' | 'season' | 'chapter'
  >,
): MediaType[] {
  const text = collectDetectionHintText(detection)
  const hints: MediaType[] = []
  const pushHint = (mediaType: MediaType) => {
    if (!hints.includes(mediaType)) {
      hints.push(mediaType)
    }
  }

  if (detection.chapter !== undefined) {
    pushHint(NOVEL_HINT_PATTERN.test(text) ? 'novel' : 'manga')
  }

  if (detection.episode !== undefined || detection.season !== undefined) {
    pushHint(ANIME_HINT_PATTERN.test(text) ? 'anime' : detection.mediaType)
  }

  if (ANIME_HINT_PATTERN.test(text)) {
    pushHint('anime')
  }

  if (MANGA_HINT_PATTERN.test(text)) {
    pushHint('manga')
  }

  if (NOVEL_HINT_PATTERN.test(text)) {
    pushHint('novel')
  }

  if (detection.mediaType !== 'unknown') {
    pushHint(detection.mediaType)
  }

  return hints
}

function scoreTitleMatch(query: string, candidateTitles: string[]): number {
  let bestScore = 0

  for (const candidate of candidateTitles) {
    if (candidate === query) {
      return 120
    }

    if (candidate.includes(query)) {
      bestScore = Math.max(bestScore, 90)
      continue
    }

    if (query.includes(candidate)) {
      bestScore = Math.max(bestScore, 80)
      continue
    }

    const queryTokens = new Set(query.split(' '))
    const candidateTokens = candidate.split(' ')
    const overlap = candidateTokens.filter((token) => queryTokens.has(token)).length
    if (overlap > 0) {
      const ratio = overlap / Math.max(queryTokens.size, candidateTokens.length)
      bestScore = Math.max(bestScore, Math.round(ratio * 60))
    }

    const compactSimilarity = getCompactTitleSimilarity(query, candidate)
    if (compactSimilarity >= 0.94) {
      bestScore = Math.max(bestScore, 88)
      continue
    }

    if (compactSimilarity >= 0.9) {
      bestScore = Math.max(bestScore, 78)
      continue
    }

    if (compactSimilarity >= 0.86) {
      bestScore = Math.max(bestScore, 68)
      continue
    }
  }

  return bestScore
}

function getCompactTitleSimilarity(left: string, right: string): number {
  const compactLeft = left.replace(/\s+/g, '')
  const compactRight = right.replace(/\s+/g, '')

  if (!compactLeft || !compactRight) {
    return 0
  }

  if (compactLeft === compactRight) {
    return 1
  }

  if (compactLeft.length < 2 || compactRight.length < 2) {
    return 0
  }

  const leftBigrams = new Map<string, number>()
  for (let index = 0; index < compactLeft.length - 1; index += 1) {
    const bigram = compactLeft.slice(index, index + 2)
    leftBigrams.set(bigram, (leftBigrams.get(bigram) ?? 0) + 1)
  }

  let overlap = 0
  for (let index = 0; index < compactRight.length - 1; index += 1) {
    const bigram = compactRight.slice(index, index + 2)
    const count = leftBigrams.get(bigram) ?? 0
    if (count > 0) {
      overlap += 1
      leftBigrams.set(bigram, count - 1)
    }
  }

  return (2 * overlap) / (compactLeft.length + compactRight.length - 2)
}

export function pickBestMetadataMatch(
  items: MetadataCard[],
  query: string,
  preferredMediaTypes: MediaType[] = [],
  preferredSeason?: number,
): MetadataCard | undefined {
  const normalizedQuery = normalizeTitle(query)
  if (!normalizedQuery) {
    return undefined
  }

  const ranked = items
    .map((item, index) => {
      const titleScore = scoreTitleMatch(normalizedQuery, getMetadataNormalizedTitles(item))
      if (titleScore === 0) {
        return null
      }

      const mediaTypeScore = preferredMediaTypes.includes(item.mediaType)
        ? 30 - preferredMediaTypes.indexOf(item.mediaType) * 4
        : 0
      const itemSeasonNumber = getMetadataSeasonNumber(item)
      const seasonScore =
        preferredSeason === undefined
          ? 0
          : itemSeasonNumber === preferredSeason
            ? 24
            : itemSeasonNumber === undefined
              ? 0
              : -36
      const providerBias =
        item.id.startsWith('anilist:') &&
        preferredMediaTypes.some((mediaType) => mediaType === 'anime' || mediaType === 'manga')
          ? 3
          : 0

      return {
        item,
        score: titleScore + mediaTypeScore + seasonScore + providerBias,
        index,
      }
    })
    .filter((entry): entry is { item: MetadataCard; score: number; index: number } =>
      Boolean(entry),
    )
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return left.index - right.index
    })

  return ranked[0]?.score >= 60 ? ranked[0].item : undefined
}

export function areDetectionAndMetadataCompatible(
  detection: Pick<DetectionResult, 'season' | 'title'>,
  metadata: Pick<MetadataCard, 'seasonNumber' | 'title' | 'aliases'>,
): boolean {
  return areSeasonNumbersCompatible(
    getDetectionSeasonNumber(detection),
    getMetadataSeasonNumber(metadata),
  )
}

export function areCatalogAndDetectionCompatible(
  catalog: Pick<CatalogEntry, 'seasonNumber' | 'title' | 'aliases'>,
  detection: Pick<DetectionResult, 'season' | 'title'>,
  fallbackSeason?: number,
): boolean {
  return areSeasonNumbersCompatible(
    catalog.seasonNumber,
    getDetectionSeasonNumber(detection) ?? fallbackSeason,
  )
}
