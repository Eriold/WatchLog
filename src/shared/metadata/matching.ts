import type { DetectionResult, MediaType, MetadataCard } from '../types'
import { normalizeTitle } from '../utils/normalize'

const ANIME_HINT_PATTERN =
  /\b(?:anime|jkanime|animeflv|animeav1|crunchyroll|hidive|otaku|otakudesu|animesaturn|aniwatch)\b/i
const MANGA_HINT_PATTERN =
  /\b(?:manga|manhwa|manhua|webtoon|lectormanga|lectortmo|mangadex|manganato|asurascans)\b/i
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

export function getMetadataNormalizedTitles(item: MetadataCard): string[] {
  return uniqueNormalizedTitles([item.title, ...(item.aliases ?? [])])
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
  }

  return bestScore
}

export function pickBestMetadataMatch(
  items: MetadataCard[],
  query: string,
  preferredMediaTypes: MediaType[] = [],
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
      const providerBias =
        item.id.startsWith('anilist:') &&
        preferredMediaTypes.some((mediaType) => mediaType === 'anime' || mediaType === 'manga')
          ? 3
          : 0

      return {
        item,
        score: titleScore + mediaTypeScore + providerBias,
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
