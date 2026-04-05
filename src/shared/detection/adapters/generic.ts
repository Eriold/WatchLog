import type { DetectionAdapter } from '../../types'
import { buildDetection, getMeta, queryText } from '../helpers'

export const genericAdapter: DetectionAdapter = {
  id: 'generic',
  siteName: 'Web',
  matches: () => true,
  detect(context) {
    const rawTitle =
      getMeta(context.document, 'og:title') ??
      queryText(context.document, ['main h1', 'article h1', 'h1']) ??
      context.title

    return buildDetection(context, context.url.hostname.replace(/^www\./, ''), rawTitle, 0.45)
  },
}
