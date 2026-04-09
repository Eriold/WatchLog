import type { DetectionResult } from '../types'
import { normalizeTitle } from '../utils/normalize'
import {
  cleanTitle,
  getFavicon,
  type FaviconCandidate,
  inferMediaType,
  isPlaceholderTitle,
  parseProgress,
  resolveDetectedTitle,
} from './helpers'

export interface ScriptedDetectionSnapshot {
  href: string
  pageTitle: string
  bodyText: string
  faviconCandidates: FaviconCandidate[]
  titleCandidates: string[]
  playerResponseTitle: string | null
  ogTitle: string | null
  metaTitle: string | null
  itempropName: string | null
}

export const SCRIPTED_TEXT_TITLE_SELECTORS = [
  'button.text-xs.font-bold.text-white.truncate.leading-tight',
  'button.text-xs.font-bold.text-white.leading-tight',
  'button.font-bold.truncate.leading-tight',
  'ytd-watch-metadata h1',
  '#title h1',
  'h1.ytd-watch-metadata',
  'yt-formatted-string.style-scope.ytd-watch-metadata',
  'main h1',
  'article h1',
  'h1',
] as const

function inferSourceSite(url: URL): string {
  const hostname = url.hostname

  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
    return 'YouTube'
  }

  if (hostname.includes('netflix.com')) {
    return 'Netflix'
  }

  if (hostname.includes('max.com')) {
    return 'Max'
  }

  if (hostname.includes('primevideo.com') || hostname.includes('amazon.com')) {
    return 'Prime Video'
  }

  return hostname.replace(/^www\./i, '')
}

export function buildDetectionFromScriptedSnapshot(
  snapshot: ScriptedDetectionSnapshot,
  tabFaviconUrl?: string | null,
): DetectionResult | null {
  const url = new URL(snapshot.href)
  const sourceSite = inferSourceSite(url)
  const rawTitle = resolveDetectedTitle(sourceSite, [
    ...snapshot.titleCandidates,
    snapshot.playerResponseTitle,
    snapshot.ogTitle,
    snapshot.metaTitle,
    snapshot.itempropName,
    snapshot.pageTitle,
  ])

  if (!rawTitle) {
    return null
  }

  const title = cleanTitle(rawTitle, sourceSite)
  if (!title || isPlaceholderTitle(title, sourceSite)) {
    return null
  }

  const parsed = parseProgress(`${rawTitle} ${snapshot.pageTitle} ${snapshot.bodyText}`)

  return {
    title,
    normalizedTitle: normalizeTitle(title),
    mediaType: inferMediaType(url, parsed, title),
    sourceSite,
    url: url.toString(),
    favicon: getFavicon(url, {
      candidates: snapshot.faviconCandidates,
      tabFaviconUrl,
    }),
    pageTitle: snapshot.pageTitle,
    season: parsed.season,
    episode: parsed.episode,
    episodeTotal: parsed.episodeTotal,
    chapter: parsed.chapter,
    chapterTotal: parsed.chapterTotal,
    progressLabel: parsed.progressLabel,
    confidence: 0.78,
  }
}
