import type { DetectionContext, DetectionResult, MediaType } from '../types'
import {
  getFavicon as resolveFavicon,
  type FaviconCandidate,
} from '../utils/favicon'
import { compactText, normalizeTitle } from '../utils/normalize'

function toTitleCase(value: string): string {
  return value
    .split(' ')
    .map((word) => {
      if (!word) {
        return word
      }

      return word[0]!.toUpperCase() + word.slice(1)
    })
    .join(' ')
}

export function compactTitleSlug(value: string): string {
  return toTitleCase(
    compactText(decodeURIComponent(value).replace(/[-_]+/g, ' ')).replace(/\s+/g, ' '),
  )
}

export function createDetectionContext(
  document: Document,
  href = window.location.href,
): DetectionContext {
  return {
    url: new URL(href),
    title: document.title,
    document,
    bodyText: compactText(document.body?.innerText ?? ''),
  }
}

export function getMeta(document: Document, property: string): string | null {
  const meta =
    document.querySelector(`meta[property="${property}"]`) ??
    document.querySelector(`meta[name="${property}"]`)

  return meta?.getAttribute('content')?.trim() ?? null
}

export function queryAttribute(
  document: Document,
  selector: string,
  attribute: string,
): string | null {
  return document.querySelector(selector)?.getAttribute(attribute)?.trim() ?? null
}

export function queryText(document: Document, selectors: string[]): string | null {
  for (const selector of selectors) {
    const text = document.querySelector(selector)?.textContent?.trim()
    if (text) {
      return compactText(text)
    }
  }

  return null
}

export function getFirstHeadingText(document: Document, selector = 'h1'): string | null {
  const headings = Array.from(document.querySelectorAll(selector))

  for (const heading of headings) {
    const text = heading.textContent?.trim()
    if (text) {
      return compactText(text)
    }
  }

  return null
}

export function cleanTitle(title: string, siteName: string): string {
  const cleaned = compactText(
    title
      .replace(new RegExp(`\\s*[|\\-]\\s*${siteName}$`, 'i'), '')
      .replace(/\s*[|\u00b7\u2022]\s*(Netflix|Prime Video|MAX|HBO Max|YouTube|Shadow\s*Manga)$/i, '')
      .trim(),
  )

  const seoTitlePatterns = [
    /^(?:leer|lee|read)\s+(.+?)\s+(?:manga|manhwa|manhua|webtoon)(?:\s+online)?(?:\s+(?:en|in)\s+(?:espanol|español|spanish|english))?(?:\s+gratis)?$/i,
    /^(.+?)\s+(?:manga|manhwa|manhua|webtoon)(?:\s+online)?(?:\s+(?:en|in)\s+(?:espanol|español|spanish|english))?(?:\s+gratis)?$/i,
  ]

  for (const pattern of seoTitlePatterns) {
    const match = cleaned.match(pattern)
    const candidate = match?.[1]?.trim()
    const normalizedCandidate = candidate ? normalizeTitle(candidate) : ''
    if (candidate && !/^(?:leer|lee|read)$/.test(normalizedCandidate)) {
      return compactText(candidate)
    }
  }

  return cleaned
}

function stripLeadingProgressDecorators(title: string): string {
  const leadingProgressPatterns = [
    /^(?:S(?:eason)?\s*\d+\s*[:\- ]?\s*E(?:p(?:isode)?)?\s*\d+(?:\s*\/\s*\d+)?\s*[-:|]\s*)/i,
    /^(?:Season\s*\d+\s*Episode\s*\d+(?:\s*of\s*\d+)?\s*[-:|]\s*)/i,
    /^(?:Temporada\s*\d+\s*(?:Cap[ií]tulo|Capitulo|Episodio)\s*\d+(?:\s*\/\s*\d+)?\s*[-:|]\s*)/i,
    /^(?:(?:Episode|Episodio|Ep\.?|Cap[ií]tulo|Capitulo|Cap\.?|Chapter|Ch\.?)\s*\d+(?:\s*\/\s*\d+)?\s*[-:|]\s*)/i,
  ]

  for (const pattern of leadingProgressPatterns) {
    if (pattern.test(title)) {
      return compactText(title.replace(pattern, ''))
    }
  }

  return title
}

function stripTrailingProgressDecorators(title: string): string {
  const decoratedProgressPatterns = [
    /\b(?:S(?:eason)?\s*\d+\s*[:\- ]?\s*E(?:p(?:isode)?)?\s*\d+(?:\s*\/\s*\d+)?|Season\s*\d+\s*Episode\s*\d+(?:\s*of\s*\d+)?|Temporada\s*\d+\s*(?:Cap[ií]tulo|Capitulo|Episodio)\s*\d+(?:\s*\/\s*\d+)?|(?:Episode|Episodio|Ep\.?|Cap[ií]tulo|Capitulo|Cap\.?|Chapter|Ch\.?)\s*\d+(?:\s*\/\s*\d+)?)(?:\b.*)?$/i,
  ]

  for (const pattern of decoratedProgressPatterns) {
    const match = pattern.exec(title)
    if (match && match.index > 0) {
      return compactText(title.slice(0, match.index))
    }
  }

  return title
}

export function looksLikeStandaloneProgressLabel(title: string): boolean {
  const normalized = compactText(title)

  const standaloneProgressPatterns = [
    /^(?:S(?:eason)?\s*\d+\s*[:\- ]?\s*E(?:p(?:isode)?)?\s*\d+(?:\s*\/\s*\d+)?)$/i,
    /^(?:Season\s*\d+\s*Episode\s*\d+(?:\s*of\s*\d+)?)$/i,
    /^(?:Temporada\s*\d+\s*(?:Cap[ií]tulo|Capitulo|Episodio)\s*\d+(?:\s*\/\s*\d+)?)$/i,
    /^(?:Episode|Episodio|Ep\.?|Cap[ií]tulo|Capitulo|Cap\.?|Chapter|Ch\.?)\s*\d+(?:\s*\/\s*\d+)?$/i,
  ]

  return standaloneProgressPatterns.some((pattern) => pattern.test(normalized))
}

export function resolveDetectedTitle(
  siteName: string,
  candidates: Array<string | null | undefined>,
): string | null {
  const useProgressStripping = !/youtube/i.test(siteName)
  const seen = new Set<string>()

  for (const candidate of candidates) {
    if (!candidate) {
      continue
    }

    const cleaned = cleanTitle(candidate, siteName)
    if (!cleaned || isPlaceholderTitle(cleaned, siteName)) {
      continue
    }

    if (seen.has(cleaned)) {
      continue
    }
    seen.add(cleaned)

    if (!looksLikeStandaloneProgressLabel(cleaned)) {
      const stripped = useProgressStripping
        ? stripTrailingProgressDecorators(stripLeadingProgressDecorators(cleaned))
        : cleaned
      if (stripped && !looksLikeStandaloneProgressLabel(stripped)) {
        return stripped
      }
    }
  }

  return null
}

export function isPlaceholderTitle(title: string, siteName: string): boolean {
  const normalizedTitle = normalizeTitle(title)
  const normalizedSite = normalizeTitle(siteName)

  if (!normalizedTitle) {
    return true
  }

  if (normalizedTitle === normalizedSite) {
    return true
  }

  const placeholderTitles = new Set([
    'youtube',
    'watch on youtube',
    'netflix',
    'max',
    'hbo max',
    'prime video',
    'amazon prime video',
    'watch',
    'video',
    'streaming',
    'detalle de serie',
  ])

  if (placeholderTitles.has(normalizedTitle)) {
    return true
  }

  const genericReadingHubPatterns = [
    /^(?:(?:leer|lee|read)\s+)?(?:manga|manhwa|manhua|webtoon)(?:\s+(?:en|in)\s+(?:espanol|spanish|english))?$/i,
  ]

  return genericReadingHubPatterns.some((pattern) => pattern.test(normalizedTitle))
}

export { type FaviconCandidate }

export function getFavicon(
  url: URL,
  options?: {
    document?: Document
    candidates?: FaviconCandidate[]
    tabFaviconUrl?: string | null
  },
): string {
  return resolveFavicon(url, options)
}

export function parseProgress(text: string): {
  season?: number
  episode?: number
  episodeTotal?: number
  chapter?: number
  chapterTotal?: number
  progressLabel: string
} {
  const normalized = compactText(text)

  const seasonEpisodePatterns = [
    /S(?:eason)?\s*(\d+)\s*[:\- ]?\s*E(?:p(?:isode)?)?\s*(\d+)(?:\s*\/\s*(\d+))?/i,
    /Season\s*(\d+)\s*Episode\s*(\d+)(?:\s*of\s*(\d+))?/i,
    /(\d+)(?:st|nd|rd|th)\s+Season\s*Episode\s*(\d+)(?:\s*of\s*(\d+))?/i,
    /Temporada\s*(\d+)\s*(?:Cap[ií]tulo|Capitulo|Episodio)\s*(\d+)(?:\s*\/\s*(\d+))?/i,
  ]

  for (const pattern of seasonEpisodePatterns) {
    const match = normalized.match(pattern)
    if (match) {
      const season = Number(match[1])
      const episode = Number(match[2])
      const episodeTotal = match[3] ? Number(match[3]) : undefined

      return {
        season,
        episode,
        episodeTotal,
        progressLabel: `S${season} ${episode}${episodeTotal ? `/${episodeTotal}` : ''}`,
      }
    }
  }

  const episodePatterns = [
    /Episode\s*(\d+)(?:\s*\/\s*(\d+))?/i,
    /Episodio\s*(\d+)(?:\s*\/\s*(\d+))?/i,
    /Ep\.?\s*(\d+)(?:\s*\/\s*(\d+))?/i,
  ]

  for (const pattern of episodePatterns) {
    const match = normalized.match(pattern)
    if (match) {
      const episode = Number(match[1])
      const episodeTotal = match[2] ? Number(match[2]) : undefined

      return {
        episode,
        episodeTotal,
        progressLabel: `Ep ${episode}${episodeTotal ? `/${episodeTotal}` : ''}`,
      }
    }
  }

  const chapterPatterns = [
    /Chapter\s*(\d+)(?:\s*\/\s*(\d+))?/i,
    /Cap[ií]tulo\s*(\d+)(?:\s*\/\s*(\d+))?/i,
    /Capitulo\s*(\d+)(?:\s*\/\s*(\d+))?/i,
    /Ch\.?\s*(\d+)(?:\s*\/\s*(\d+))?/i,
  ]

  for (const pattern of chapterPatterns) {
    const match = normalized.match(pattern)
    if (match) {
      const chapter = Number(match[1])
      const chapterTotal = match[2] ? Number(match[2]) : undefined

      return {
        chapter,
        chapterTotal,
        progressLabel: `Cap ${chapter}${chapterTotal ? `/${chapterTotal}` : ''}`,
      }
    }
  }

  return {
    progressLabel: 'Sin progreso detectado',
  }
}

export function inferMediaType(
  url: URL,
  parsed: ReturnType<typeof parseProgress>,
  fallbackTitle: string,
): MediaType {
  const hostname = url.hostname
  const hintText = `${hostname} ${url.pathname} ${fallbackTitle}`.toLowerCase()
  const looksLikeAnimeSite =
    /\b(?:anime|jkanime|animeflv|animeav1|crunchyroll|hidive|otaku|otakudesu|animesaturn|aniwatch)\b/i.test(
      hintText,
    )
  const looksLikeMangaSite =
    /\b(?:manga|manhwa|manhua|webtoon|lectormanga|lectortmo|mangadex|manganato|asurascans|shadowmanga|inmanga)\b/i.test(
      hintText,
    )
  const looksLikeNovelSite = /\b(?:novel|ranobe|light\s*novel|web\s*novel)\b/i.test(hintText)
  const inferTextMangaSubtype = (): MediaType => {
    if (/\bmanhwa\b/i.test(hintText)) {
      return 'manhwa'
    }

    if (/\bmanhua\b/i.test(hintText)) {
      return 'manhua'
    }

    return 'manga'
  }

  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
    return 'video'
  }

  if (parsed.chapter) {
    return looksLikeNovelSite ? 'novel' : inferTextMangaSubtype()
  }

  if (parsed.season || parsed.episode) {
    return looksLikeAnimeSite ? 'anime' : 'series'
  }

  if (looksLikeAnimeSite) {
    return 'anime'
  }

  if (looksLikeMangaSite) {
    return inferTextMangaSubtype()
  }

  if (looksLikeNovelSite) {
    return 'novel'
  }

  return 'movie'
}

export function buildDetection(
  context: DetectionContext,
  siteName: string,
  rawTitle: string,
  confidence: number,
): DetectionResult | null {
  const title = resolveDetectedTitle(siteName, [rawTitle])
  if (!title || isPlaceholderTitle(title, siteName)) {
    return null
  }

  const parsed = parseProgress(`${rawTitle} ${context.title} ${context.bodyText}`)

  return {
    title,
    normalizedTitle: normalizeTitle(title),
    mediaType: inferMediaType(context.url, parsed, title),
    sourceSite: siteName,
    url: context.url.toString(),
    favicon: getFavicon(context.url, { document: context.document }),
    pageTitle: context.title,
    season: parsed.season,
    episode: parsed.episode,
    episodeTotal: parsed.episodeTotal,
    chapter: parsed.chapter,
    chapterTotal: parsed.chapterTotal,
    progressLabel: parsed.progressLabel,
    confidence,
  }
}
