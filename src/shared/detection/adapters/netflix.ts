import type { DetectionAdapter } from '../../types'
import { buildDetection, getMeta, queryText } from '../helpers'

export const netflixAdapter: DetectionAdapter = {
  id: 'netflix',
  siteName: 'Netflix',
  matches: (url) => url.hostname.includes('netflix.com'),
  detect(context) {
    const rawTitle =
      queryText(context.document, [
        '[data-uia="video-title"]',
        '[data-videoid] h4',
        '.video-title h4',
        'h1',
      ]) ??
      getMeta(context.document, 'og:title') ??
      context.title

    return buildDetection(context, 'Netflix', rawTitle, 0.92)
  },
}
