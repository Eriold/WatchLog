export interface FaviconCandidate {
  href: string
  rel?: string | null
  type?: string | null
  sizes?: string | null
}

interface GetFaviconOptions {
  document?: Document
  candidates?: FaviconCandidate[]
  tabFaviconUrl?: string | null
}

const FORMAT_SCORES: Array<[string, number]> = [
  ['image/svg+xml', 40],
  ['image/avif', 36],
  ['image/png', 34],
  ['image/webp', 32],
  ['image/jpeg', 28],
  ['image/jpg', 28],
  ['image/gif', 24],
  ['image/bmp', 18],
  ['image/vnd.microsoft.icon', 16],
  ['image/x-icon', 16],
]

const EXTENSION_SCORES: Array<[string, number]> = [
  ['.svg', 40],
  ['.avif', 36],
  ['.png', 34],
  ['.webp', 32],
  ['.jpg', 28],
  ['.jpeg', 28],
  ['.gif', 24],
  ['.bmp', 18],
  ['.ico', 16],
]

function normalizeFaviconHref(rawHref: string, pageUrl: URL): string | null {
  const trimmed = rawHref.trim()
  if (!trimmed) {
    return null
  }

  if (trimmed.startsWith('data:image/') || trimmed.startsWith('blob:')) {
    return trimmed
  }

  try {
    const parsed = new URL(trimmed, pageUrl)
    if (parsed.protocol === 'http:') {
      parsed.protocol = 'https:'
    }

    return parsed.toString()
  } catch {
    return null
  }
}

function getFormatScore(type?: string | null): number {
  const normalized = type?.trim().toLowerCase()
  if (!normalized) {
    return 0
  }

  for (const [pattern, score] of FORMAT_SCORES) {
    if (normalized === pattern) {
      return score
    }
  }

  return normalized.startsWith('image/') ? 12 : 0
}

function getExtensionScore(url: string): number {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    for (const [extension, score] of EXTENSION_SCORES) {
      if (pathname.endsWith(extension)) {
        return score
      }
    }

    return /(?:favicon|icon)(?:[._-]|$)/i.test(pathname) ? 10 : 0
  } catch {
    return 0
  }
}

function getSizesScore(sizes?: string | null): number {
  const normalized = sizes?.trim().toLowerCase()
  if (!normalized) {
    return 0
  }

  if (normalized === 'any') {
    return 24
  }

  const values = normalized
    .split(/\s+/)
    .map((token) => {
      const match = token.match(/^(\d+)x(\d+)$/)
      if (!match) {
        return 0
      }

      const width = Number(match[1])
      const height = Number(match[2])
      return width === height ? width : Math.min(width, height)
    })
    .filter((value) => value > 0)

  if (values.length === 0) {
    return 0
  }

  const best = Math.max(...values)
  return Math.min(30, Math.round(best / 8))
}

function getRelScore(rel?: string | null): number {
  const normalized = rel?.trim().toLowerCase() ?? ''
  if (!normalized) {
    return 0
  }

  let score = 0
  if (normalized.includes('icon')) {
    score += 30
  }
  if (normalized.includes('shortcut')) {
    score += 6
  }
  if (normalized.includes('apple-touch-icon')) {
    score += 26
  }
  if (normalized.includes('mask-icon')) {
    score += 18
  }

  return score
}

function isUsableFaviconUrl(url: string): boolean {
  if (url.startsWith('data:image/') || url.startsWith('blob:')) {
    return true
  }

  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function getExtensionFallbackIcon(): string | null {
  if (typeof chrome === 'undefined' || typeof chrome.runtime === 'undefined') {
    return null
  }

  return chrome.runtime.getURL('icons/favicon-16x16.png')
}

export function getDocumentFaviconCandidates(document: Document): FaviconCandidate[] {
  return Array.from(document.querySelectorAll('link[rel]'))
    .map((link) => ({
      href: link.getAttribute('href')?.trim() ?? '',
      rel: link.getAttribute('rel')?.trim() ?? '',
      type: link.getAttribute('type')?.trim() ?? null,
      sizes: link.getAttribute('sizes')?.trim() ?? null,
    }))
    .filter((candidate) => {
      if (!candidate.href) {
        return false
      }

      const rel = candidate.rel?.toLowerCase() ?? ''
      return (
        rel.includes('icon') ||
        rel.includes('apple-touch-icon') ||
        rel.includes('mask-icon')
      )
    })
}

export function pickBestFaviconCandidate(
  pageUrl: URL,
  candidates: FaviconCandidate[],
): string | null {
  const ranked = candidates
    .map((candidate, index) => {
      const normalizedUrl = normalizeFaviconHref(candidate.href, pageUrl)
      if (!normalizedUrl || !isUsableFaviconUrl(normalizedUrl)) {
        return null
      }

      return {
        url: normalizedUrl,
        score:
          getRelScore(candidate.rel) +
          getFormatScore(candidate.type) +
          getExtensionScore(normalizedUrl) +
          getSizesScore(candidate.sizes),
        index,
      }
    })
    .filter((candidate): candidate is { url: string; score: number; index: number } =>
      Boolean(candidate),
    )
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return left.index - right.index
    })

  return ranked[0]?.url ?? null
}

export function getFavicon(url: URL, options: GetFaviconOptions = {}): string {
  const tabFaviconUrl = options.tabFaviconUrl
    ? normalizeFaviconHref(options.tabFaviconUrl, url)
    : null

  if (tabFaviconUrl && isUsableFaviconUrl(tabFaviconUrl)) {
    return tabFaviconUrl
  }

  const candidates =
    options.candidates ?? (options.document ? getDocumentFaviconCandidates(options.document) : [])
  const candidateUrl = pickBestFaviconCandidate(url, candidates)

  if (candidateUrl) {
    return candidateUrl
  }

  const fallback = normalizeFaviconHref(`${url.origin}/favicon.ico`, url)
  return fallback ?? getExtensionFallbackIcon() ?? `${url.origin.replace(/^http:/i, 'https:')}/favicon.ico`
}
