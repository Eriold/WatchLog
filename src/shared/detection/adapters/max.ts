import type { DetectionAdapter } from '../../types'
import { buildDetection, getFirstHeadingText, getMeta, queryText } from '../helpers'

export const maxAdapter: DetectionAdapter = {
  id: 'max',
  siteName: 'Max',
  matches: (url) => url.hostname.includes('max.com') || url.hostname.includes('hbomax.com'),
  detect(context) {
    const rawTitle =
      getFirstHeadingText(context.document) ??
      queryText(context.document, [
        '[data-testid="hero-title"]',
        '[data-testid="content-title"]',
        'main h1',
        'h1',
      ]) ??
      getMeta(context.document, 'og:title') ??
      context.title

    return buildDetection(context, 'Max', rawTitle, 0.9)
  },
}
