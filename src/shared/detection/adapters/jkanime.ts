import type { DetectionAdapter } from '../../types'
import {
  buildDetection,
  getFirstHeadingText,
  getMeta,
  queryText,
  compactTitleSlug,
} from '../helpers'

function getPathTitle(url: URL): string | null {
  const slug = url.pathname
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .find((segment) => !/^\d+$/.test(segment))

  if (!slug) {
    return null
  }

  return compactTitleSlug(slug)
}

function getPathEpisode(url: URL): number | undefined {
  const segments = url.pathname
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)

  const lastSegment = segments.at(-1)
  if (!lastSegment || !/^\d+$/.test(lastSegment)) {
    return undefined
  }

  return Number(lastSegment)
}

export const jkanimeAdapter: DetectionAdapter = {
  id: 'jkanime',
  siteName: 'jkanime.net',
  matches: (url) => url.hostname.includes('jkanime.net'),
  detect(context) {
    const pathTitle = getPathTitle(context.url)
    const rawTitle =
      pathTitle ??
      getFirstHeadingText(context.document) ??
      getMeta(context.document, 'og:title') ??
      queryText(context.document, ['main h1', 'article h1', 'h1']) ??
      context.title

    const detection = buildDetection(context, 'jkanime.net', rawTitle, pathTitle ? 0.86 : 0.7)
    if (!detection) {
      return null
    }

    const episode = detection.episode ?? getPathEpisode(context.url)
    if (episode === undefined) {
      return detection
    }

    return {
      ...detection,
      episode,
      progressLabel: detection.progressLabel === 'Sin progreso detectado' ? `Ep ${episode}` : detection.progressLabel,
    }
  },
}
