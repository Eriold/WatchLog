import type { DetectionAdapter } from '../../types'
import {
  buildDetection,
  getFirstHeadingText,
  getMeta,
  queryText,
  resolveDetectedTitle,
} from '../helpers'

export const genericAdapter: DetectionAdapter = {
  id: 'generic',
  siteName: 'Web',
  matches: () => true,
  detect(context) {
    const rawTitle = resolveDetectedTitle(context.url.hostname.replace(/^www\./, ''), [
      getFirstHeadingText(context.document),
      getMeta(context.document, 'og:title'),
      queryText(context.document, ['main h1', 'article h1', 'h1']),
      context.title,
    ])

    if (!rawTitle) {
      return null
    }

    return buildDetection(context, context.url.hostname.replace(/^www\./, ''), rawTitle, 0.45)
  },
}
