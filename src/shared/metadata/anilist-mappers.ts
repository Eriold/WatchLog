import type { FuzzyDate, MediaType, MetadataCard, PublicationStatus } from '../types'
import { inferSeasonNumberFromTitles } from '../season'
import { normalizeTitle } from '../utils/normalize'

export type AniListMediaType = 'ANIME' | 'MANGA'

export interface AniListMedia {
  id: number
  type: AniListMediaType
  format?: string | null
  status?: PublicationStatus | null
  startDate?: {
    year?: number | null
    month?: number | null
    day?: number | null
  } | null
  endDate?: {
    year?: number | null
    month?: number | null
    day?: number | null
  } | null
  episodes?: number | null
  chapters?: number | null
  duration?: number | null
  seasonYear?: number | null
  genres?: string[] | null
  description?: string | null
  averageScore?: number | null
  title?: {
    romaji?: string | null
    english?: string | null
    native?: string | null
  } | null
  coverImage?: {
    extraLarge?: string | null
    large?: string | null
    medium?: string | null
  } | null
  bannerImage?: string | null
  nextAiringEpisode?: {
    episode?: number | null
  } | null
}

export function pickAniListTitle(media: AniListMedia): string {
  return (
    media.title?.english?.trim() ||
    media.title?.romaji?.trim() ||
    media.title?.native?.trim() ||
    `AniList ${media.id}`
  )
}

function getAniListAliases(media: AniListMedia, title: string): string[] {
  const seen = new Set<string>()
  const aliases: string[] = []

  for (const candidate of [
    media.title?.english?.trim(),
    media.title?.romaji?.trim(),
    media.title?.native?.trim(),
  ]) {
    if (!candidate || candidate === title || seen.has(candidate)) {
      continue
    }

    seen.add(candidate)
    aliases.push(candidate)
  }

  return aliases
}

function decodeHtmlEntities(input: string): string {
  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea')
    textarea.innerHTML = input
    return textarea.value
  }

  return input
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
  }

export function sanitizeAniListDescription(description?: string | null): string {
  if (!description) {
    return 'No description available yet.'
  }

  const normalizedBreaks = description
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')

  return decodeHtmlEntities(normalizedBreaks)
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function mapAniListTypeToMediaType(
  type: AniListMediaType,
  format?: AniListMedia['format'],
): MediaType {
  if (type === 'ANIME') {
    return 'anime'
  }

  if (format?.trim().toUpperCase() === 'NOVEL') {
    return 'novel'
  }

  return 'manga'
}

export function getAniListAvailableEpisodeCount(media: AniListMedia): number | undefined {
  if (typeof media.episodes === 'number' && media.episodes > 0) {
    return media.episodes
  }

  const nextEpisode = media.nextAiringEpisode?.episode
  if (typeof nextEpisode === 'number' && nextEpisode > 1) {
    return nextEpisode - 1
  }

  return undefined
}

function mapAniListFuzzyDate(
  value?: AniListMedia['startDate'] | AniListMedia['endDate'],
): FuzzyDate | undefined {
  if (!value) {
    return undefined
  }

  const next: FuzzyDate = {
    year: value.year ?? undefined,
    month: value.month ?? undefined,
    day: value.day ?? undefined,
  }

  if (
    next.year === undefined &&
    next.month === undefined &&
    next.day === undefined
  ) {
    return undefined
  }

  return next
}

export function mapAniListMediaToMetadataCard(media: AniListMedia): MetadataCard {
  const title = pickAniListTitle(media)
  const score =
    typeof media.averageScore === 'number' ? Math.round(media.averageScore) / 10 : undefined
  const resolvedEpisodeCount =
    media.type === 'ANIME' ? getAniListAvailableEpisodeCount(media) : undefined
  const startDate = mapAniListFuzzyDate(media.startDate)
  const endDate = mapAniListFuzzyDate(media.endDate)

  return {
    id: `anilist:${media.id}`,
    title,
    normalizedTitle: normalizeTitle(title),
    aliases: getAniListAliases(media, title),
    sourceUrl: `https://anilist.co/${media.type === 'ANIME' ? 'anime' : 'manga'}/${media.id}`,
    seasonNumber: inferSeasonNumberFromTitles([
      media.title?.english?.trim(),
      media.title?.romaji?.trim(),
      media.title?.native?.trim(),
    ]),
    mediaType: mapAniListTypeToMediaType(media.type, media.format),
    poster:
      media.coverImage?.extraLarge ??
      media.coverImage?.large ??
      media.coverImage?.medium ??
      undefined,
    backdrop: media.bannerImage ?? undefined,
    genres: media.genres ?? [],
    description: sanitizeAniListDescription(media.description),
    publicationStatus: media.status ?? undefined,
    startDate,
    endDate,
    releaseYear: startDate?.year ?? media.seasonYear ?? undefined,
    runtime: media.type === 'ANIME' ? media.duration ?? undefined : undefined,
    seasonCount: undefined,
    episodeCount: resolvedEpisodeCount,
    chapterCount: media.type === 'MANGA' ? media.chapters ?? undefined : undefined,
    score,
  }
}
