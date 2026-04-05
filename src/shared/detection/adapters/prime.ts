import type { DetectionAdapter } from '../../types'
import { buildDetection, getMeta, queryText } from '../helpers'

export const primeAdapter: DetectionAdapter = {
  id: 'prime',
  siteName: 'Prime Video',
  matches: (url) => url.hostname.includes('primevideo.com') || url.hostname.includes('amazon.com'),
  detect(context) {
    const rawTitle =
      queryText(context.document, [
        '[data-automation-id="title"]',
        '[data-testid="content-title"]',
        'main h1',
        'h1',
      ]) ??
      getMeta(context.document, 'og:title') ??
      context.title

    return buildDetection(context, 'Prime Video', rawTitle, 0.88)
  },
}
