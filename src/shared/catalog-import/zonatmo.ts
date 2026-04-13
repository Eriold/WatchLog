import type { CatalogImportItem, CatalogImportSnapshot } from './types'
import type { MediaType } from '../types'

function parseZonaTmoListUrl(href: string): {
  sourceSite: string
  sourceUrl: string
  listId: string | null
  listSlug: string | null
} | null {
  try {
    const url = new URL(href)
    const hostname = url.hostname.toLowerCase()
    const segments = url.pathname.split('/').filter(Boolean)

    if (!hostname.includes('zonatmo') || segments[0] !== 'lists' || !segments[1]) {
      return null
    }

    return {
      sourceSite: hostname,
      sourceUrl: url.toString(),
      listId: segments[1] ?? null,
      listSlug: segments[2] ?? null,
    }
  } catch {
    return null
  }
}

export function isZonaTmoCatalogPage(href: string): boolean {
  return parseZonaTmoListUrl(href) !== null
}

export function extractZonaTmoCatalogSnapshot(
  documentArg: Document = document,
  hrefArg: string = window.location.href,
): CatalogImportSnapshot | null {
  const parseListPage = (href: string) => {
    try {
      const url = new URL(href)
      const hostname = url.hostname.toLowerCase()
      const segments = url.pathname.split('/').filter(Boolean)

      if (!hostname.includes('zonatmo') || segments[0] !== 'lists' || !segments[1]) {
        return null
      }

      return {
        sourceSite: hostname,
        sourceUrl: url.toString(),
        listId: segments[1] ?? null,
        listSlug: segments[2] ?? null,
      }
    } catch {
      return null
    }
  }

  const compactText = (value: string | null | undefined): string => {
    return (value ?? '').replace(/\s+/g, ' ').trim()
  }

  const normalizeTitle = (value: string): string => {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\b(?:watch|streaming|online)\b/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  const toTitleCase = (value: string | null): string => {
    const normalized = compactText((value ?? '').replace(/[-_]+/g, ' '))
    if (!normalized) {
      return 'ZonaTMO import'
    }

    return normalized.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())
  }

  const resolveUrl = (rawValue: string | null | undefined): string | null => {
    const raw = compactText(rawValue)
    if (!raw) {
      return null
    }

    try {
      return new URL(raw, hrefArg).toString()
    } catch {
      return null
    }
  }

  const parseScore = (value: string | null | undefined): number | undefined => {
    const raw = compactText(value)
    if (!raw) {
      return undefined
    }

    const parsed = Number.parseFloat(raw.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : undefined
  }

  const parseCounts = () => {
    const candidates = Array.from(documentArg.querySelectorAll('h1, h2, h3'))
      .map((element) => compactText(element.textContent))
      .filter(Boolean)

    for (const candidate of candidates) {
      const match = candidate.match(/elementos?\s+(\d+)\s*\/\s*(\d+)/i)
      if (!match) {
        continue
      }

      return {
        reportedCount: Number.parseInt(match[1], 10),
        maxCount: Number.parseInt(match[2], 10),
      }
    }

    return {
      reportedCount: undefined,
      maxCount: undefined,
    }
  }

  const extractPosterUrl = (container: Element): string | undefined => {
    const styleText = Array.from(container.querySelectorAll('style'))
      .map((style) => style.textContent ?? '')
      .join('\n')
    const match = styleText.match(/background-image:\s*url\((['"]?)(.+?)\1\)/i)
    const resolved = resolveUrl(match?.[2])
    return resolved ?? undefined
  }

  const mapMediaType = (sourceTypeLabel: string, sourceUrl: string): MediaType => {
    const value = `${sourceTypeLabel} ${sourceUrl}`.toLowerCase()
    if (/\b(?:novela|novel)\b/.test(value)) {
      return 'novel'
    }

    if (/\bmanhwa\b/.test(value)) {
      return 'manhwa'
    }

    if (/\bmanhua\b/.test(value)) {
      return 'manhua'
    }

    if (/\b(?:manga|manhwa|manhua)\b/.test(value)) {
      return 'manga'
    }

    return 'unknown'
  }

  const page = parseListPage(hrefArg)
  if (!page) {
    return null
  }

  const seen = new Set<string>()
  const items: CatalogImportItem[] = []

  for (const element of Array.from(documentArg.querySelectorAll('.element[data-identifier]'))) {
    const sourceId = compactText(element.getAttribute('data-identifier'))
    const anchor = element.querySelector<HTMLAnchorElement>('a[href]')
    const sourceUrl = resolveUrl(anchor?.getAttribute('href'))
    const heading = element.querySelector<HTMLElement>('.thumbnail-title h4')
    const title = compactText(heading?.getAttribute('title') ?? heading?.textContent)
    const sourceTypeLabel = compactText(element.querySelector('.book-type')?.textContent)
    const demography = compactText(element.querySelector('.demography')?.textContent)
    const score = parseScore(
      element.querySelector('.score span:last-child, .score span')?.textContent,
    )

    if (!sourceId || !sourceUrl || !title) {
      continue
    }

    const mediaType = mapMediaType(sourceTypeLabel, sourceUrl)
    const normalizedTitle = normalizeTitle(title)
    if (!normalizedTitle) {
      continue
    }

    const dedupeKey = `${sourceUrl}:${normalizedTitle}:${mediaType}`
    if (seen.has(dedupeKey)) {
      continue
    }

    seen.add(dedupeKey)

    const item: CatalogImportItem = {
      sourceId,
      title,
      normalizedTitle,
      sourceUrl,
      mediaType,
      sourceTypeLabel: sourceTypeLabel || undefined,
      tags: [demography, sourceTypeLabel].filter(Boolean),
      score,
    }

    const posterUrl = extractPosterUrl(element)
    if (posterUrl) {
      item.posterUrl = posterUrl
    }

    items.push(item)
  }

  if (items.length === 0) {
    return null
  }

  const counts = parseCounts()

  return {
    sourceSite: page.sourceSite,
    sourceUrl: page.sourceUrl,
    listId: page.listId,
    listSlug: page.listSlug,
    listLabel: toTitleCase(page.listSlug),
    visibleCount: items.length,
    reportedCount: counts.reportedCount,
    maxCount: counts.maxCount,
    items,
  }
}
