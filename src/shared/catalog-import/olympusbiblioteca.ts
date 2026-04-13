import type { CatalogImportItem, CatalogImportSnapshot } from './types'

function parseOlympusProfileUrl(href: string): {
  sourceSite: string
  sourceUrl: string
  listSlug: string | null
} | null {
  try {
    const url = new URL(href)
    const hostname = url.hostname.toLowerCase()
    const segments = url.pathname.split('/').filter(Boolean)

    if (!hostname.includes('olympusbiblioteca.com') || segments[0] !== 'perfil') {
      return null
    }

    return {
      sourceSite: hostname,
      sourceUrl: url.toString(),
      listSlug: segments[1] ?? null,
    }
  } catch {
    return null
  }
}

export function isOlympusBibliotecaCatalogPage(href: string): boolean {
  return parseOlympusProfileUrl(href) !== null
}

export function extractOlympusBibliotecaCatalogSnapshot(
  documentArg: Document = document,
  hrefArg: string = window.location.href,
): CatalogImportSnapshot | null {
  const parseListPage = (href: string) => {
    try {
      const url = new URL(href)
      const hostname = url.hostname.toLowerCase()
      const segments = url.pathname.split('/').filter(Boolean)

      if (!hostname.includes('olympusbiblioteca.com') || segments[0] !== 'perfil') {
        return null
      }

      return {
        sourceSite: hostname,
        sourceUrl: url.toString(),
        listSlug: segments[1] ?? null,
      }
    } catch {
      return null
    }
  }

  const compactText = (value: string | null | undefined): string =>
    (value ?? '').replace(/\s+/g, ' ').trim()

  const normalizeTitle = (value: string): string =>
    value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\b(?:watch|streaming|online)\b/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

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

  const toTitleCase = (value: string): string =>
    value
      .replace(/[-_]+/g, ' ')
      .trim()
      .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())

  const normalizeOlympusListLabel = (pageTitle: string, listSlug: string | null): string => {
    const normalizedTitle = normalizeTitle(pageTitle)

    if (normalizedTitle.includes('perfil') || normalizedTitle.includes('historial')) {
      return 'Historial'
    }

    if (listSlug) {
      return toTitleCase(compactText(listSlug))
    }

    return 'Historial'
  }

  const inferMediaTypeFromText = (text: string): CatalogImportItem['mediaType'] => {
    const value = text.toLowerCase()

    if (/\b(?:novel|novela|ranobe|light[-_ ]?novel|web[-_ ]?novel)\b/.test(value)) {
      return 'novel'
    }

    if (/\bmanhwa\b/.test(value)) {
      return 'manhwa'
    }

    if (/\bmanhua\b/.test(value)) {
      return 'manhua'
    }

    if (/\b(?:anime|animev|animeflv|episodio|capitulo|capítulo)\b/.test(value)) {
      return 'anime'
    }

    return 'manga'
  }

  const inferMediaTypeFromUrl = (url: string): CatalogImportItem['mediaType'] => {
    const value = url.toLowerCase()

    if (/\b(?:novel|ranobe|light[-_ ]?novel|web[-_ ]?novel)\b/.test(value)) {
      return 'novel'
    }

    if (/\bmanhwa\b/.test(value)) {
      return 'manhwa'
    }

    if (/\bmanhua\b/.test(value)) {
      return 'manhua'
    }

    return 'manga'
  }

  const page = parseListPage(hrefArg)
  if (!page) {
    console.debug('[WatchLog][Olympus] Not a recoverable profile page:', hrefArg)
    return null
  }

  const gridRoot =
    documentArg.querySelector('main .grid') ??
    documentArg.querySelector('.grid')

  const cards = gridRoot
    ? Array.from(gridRoot.children).filter(
        (element) =>
          element instanceof Element &&
          Boolean(element.querySelector('a[href*="/series/"]')),
      )
    : Array.from(documentArg.querySelectorAll('a[href*="/series/"]'))
  console.debug('[WatchLog][Olympus] Starting extraction', {
    href: hrefArg,
    cardsFound: cards.length,
    hasGridRoot: Boolean(gridRoot),
  })

  const seen = new Set<string>()
  const items: CatalogImportItem[] = []

  for (const card of cards) {
    const anchor = card.matches('a[href*="/series/"]')
      ? (card as HTMLAnchorElement)
      : card.querySelector<HTMLAnchorElement>('a[href*="/series/"]')

    const href = anchor?.getAttribute('href') ?? card.getAttribute('href')
    const sourceUrl = resolveUrl(href)
    if (!sourceUrl) {
      console.debug('[WatchLog][Olympus] Skipped card without source URL', { href })
      continue
    }

    const titleElement =
      card.querySelector('h3') ??
      card.querySelector('img[alt]') ??
      anchor?.querySelector('img[alt]') ??
      card.closest('div')?.querySelector('h3, img[alt]')

    const title = compactText(
      titleElement?.getAttribute('alt') ??
        titleElement?.textContent ??
        anchor?.textContent ??
        href?.split('/').filter(Boolean).at(-1)?.replace(/[-_]+/g, ' ') ??
        '',
    )
    if (!title) {
      console.debug('[WatchLog][Olympus] Skipped card without title', {
        sourceUrl,
      })
      continue
    }

    const normalizedTitle = normalizeTitle(title)
    if (!normalizedTitle) {
      console.debug('[WatchLog][Olympus] Skipped card with empty normalized title', {
        sourceUrl,
        title,
      })
      continue
    }

    const textBlob = compactText(
      [
        card.querySelector('h3')?.textContent,
        card.querySelector('img[alt]')?.getAttribute('alt'),
        card.querySelector('button')?.textContent,
        anchor?.textContent,
        card.textContent,
      ]
        .filter(Boolean)
        .join(' '),
    )

    const mediaType = inferMediaTypeFromText(textBlob) || inferMediaTypeFromUrl(sourceUrl)
    const sourceId = sourceUrl.replace(/\/+$/, '')
    const dedupeKey = `${sourceId}:${normalizedTitle}:${mediaType}`
    if (seen.has(dedupeKey)) {
      console.debug('[WatchLog][Olympus] Skipped duplicate card', {
        sourceUrl,
        title,
        mediaType,
      })
      continue
    }

    seen.add(dedupeKey)

    const buttonText =
      compactText(card.querySelector('button')?.textContent ?? '') ||
      compactText(card.querySelector('button')?.textContent ?? '') ||
      compactText(anchor?.parentElement?.querySelector('button')?.textContent ?? '')

    const item: CatalogImportItem = {
      sourceId,
      title,
      normalizedTitle,
      sourceUrl,
      mediaType,
      sourceTypeLabel: buttonText || undefined,
      tags: buttonText ? [buttonText] : [],
    }

    const poster =
      anchor?.querySelector<HTMLImageElement>('img[src]') ??
      card.querySelector<HTMLImageElement>('img[src]')
    const posterUrl = resolveUrl(poster?.getAttribute('src'))
    if (posterUrl) {
      item.posterUrl = posterUrl
    }

    items.push(item)
    console.debug('[WatchLog][Olympus] Recovered item', {
      title,
      normalizedTitle,
      mediaType,
      sourceUrl,
    })
  }

  if (items.length === 0) {
    console.warn('[WatchLog][Olympus] No recoverable items found', {
      href: hrefArg,
      cardsFound: cards.length,
    })
    return null
  }

  const title =
    documentArg.querySelector('title')?.textContent ??
    documentArg.querySelector('h1')?.textContent ??
    documentArg.querySelector('h2')?.textContent ??
    'Historial'

  return {
    sourceSite: page.sourceSite,
    sourceUrl: page.sourceUrl,
    listId: null,
    listSlug: page.listSlug,
    listLabel: normalizeOlympusListLabel(title, page.listSlug),
    visibleCount: items.length,
    items,
  }
}
