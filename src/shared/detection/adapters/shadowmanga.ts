import type { DetectionAdapter } from '../../types'
import { buildDetection, getMeta, queryText } from '../helpers'

const SHADOW_MANGA_SITE = 'shadowmanga.es'

const READER_TITLE_SELECTORS = [
  'button.text-xs.font-bold.text-white.truncate.leading-tight',
  'button.text-xs.font-bold.text-white.leading-tight',
  'button.font-bold.truncate.leading-tight',
]

const FALLBACK_TITLE_SELECTORS = ['main h1', 'article h1', 'h1']

export const shadowMangaAdapter: DetectionAdapter = {
  id: 'shadowmanga',
  siteName: SHADOW_MANGA_SITE,
  matches: (url) => url.hostname.includes(SHADOW_MANGA_SITE),
  detect(context) {
    const readerTitle = queryText(context.document, READER_TITLE_SELECTORS)
    const rawTitle =
      readerTitle ??
      getMeta(context.document, 'og:title') ??
      queryText(context.document, FALLBACK_TITLE_SELECTORS) ??
      context.title

    return buildDetection(
      context,
      SHADOW_MANGA_SITE,
      rawTitle,
      readerTitle ? 0.82 : 0.62,
    )
  },
}
