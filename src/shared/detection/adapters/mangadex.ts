import type { DetectionAdapter } from '../../types'
import {
  buildDetection,
  compactTitleSlug,
  getMeta,
  queryAttribute,
  queryText,
} from '../helpers'

function getTitleFromHeaderHref(href: string | null): string | null {
  if (!href) {
    return null
  }

  try {
    const url = new URL(href, 'https://mangadex.org')
    const segments = url.pathname.split('/').filter(Boolean)
    const slug = segments.at(-1)

    if (!slug || /^\d+$/.test(slug)) {
      return null
    }

    return compactTitleSlug(slug)
  } catch {
    return null
  }
}

export const mangaDexAdapter: DetectionAdapter = {
  id: 'mangadex',
  siteName: 'mangadex.org',
  matches: (url) => url.hostname.includes('mangadex.org'),
  detect(context) {
    const headerTitle =
      queryText(context.document, ['a.reader--header-manga', '.reader--header-manga']) ??
      getMeta(context.document, 'og:title') ??
      queryText(context.document, ['main h1', 'article h1', 'h1'])

    const hrefTitle = getTitleFromHeaderHref(
      queryAttribute(context.document, 'a.reader--header-manga', 'href'),
    )

    const rawTitle = headerTitle ?? hrefTitle ?? context.title
    const detection = buildDetection(context, 'mangadex.org', rawTitle, headerTitle ? 0.93 : 0.81)
    if (!detection) {
      return null
    }

    return detection
  },
}
