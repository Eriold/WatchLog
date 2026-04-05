import type { DetectionAdapter } from '../../types'
import { buildDetection, queryText } from '../helpers'

export const youtubeAdapter: DetectionAdapter = {
  id: 'youtube',
  siteName: 'YouTube',
  matches: (url) => url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be'),
  detect(context) {
    const rawTitle =
      queryText(context.document, [
        'h1.ytd-watch-metadata',
        'yt-formatted-string.style-scope.ytd-watch-metadata',
        'h1',
      ]) ?? context.title

    const detection = buildDetection(context, 'YouTube', rawTitle, 0.9)
    if (!detection) {
      return null
    }

    return {
      ...detection,
      mediaType: 'video',
    }
  },
}
