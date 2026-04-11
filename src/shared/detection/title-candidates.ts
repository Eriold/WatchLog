import type { DetectionResult, MetadataCard } from '../types'
import { normalizeTitle } from '../utils/normalize'
import { compactTitleSlug, resolveDetectedTitle } from './helpers'

function uniqueTitles(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>()
  const items: string[] = []

  for (const value of values) {
    const trimmed = value?.trim()
    if (!trimmed) {
      continue
    }

    const normalized = normalizeTitle(trimmed)
    if (!normalized || seen.has(normalized)) {
      continue
    }

    seen.add(normalized)
    items.push(trimmed)
  }

  return items
}

function getUrlSlugTitle(url: string): string | null {
  try {
    const parsed = new URL(url)
    const slug = parsed.pathname
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean)
      .find((segment) => !/^\d+$/.test(segment))

    return slug ? compactTitleSlug(slug) : null
  } catch {
    return null
  }
}

export function getDetectionTitleCandidates(
  detection: Pick<DetectionResult, 'sourceSite' | 'title' | 'pageTitle' | 'url'>,
  metadata?: Pick<MetadataCard, 'title' | 'aliases'> | null,
  extraTitles: string[] = [],
): string[] {
  return uniqueTitles([
    metadata?.title,
    detection.title,
    resolveDetectedTitle(detection.sourceSite, [detection.pageTitle]),
    getUrlSlugTitle(detection.url),
    ...(metadata?.aliases ?? []),
    ...extraTitles,
  ])
}

export function getDetectionSearchQueries(
  detection: Pick<DetectionResult, 'sourceSite' | 'title' | 'normalizedTitle' | 'pageTitle' | 'url'>,
  extraTitles: string[] = [],
): string[] {
  const candidates = getDetectionTitleCandidates(detection, null, extraTitles)
  const normalizedCandidates = candidates.map((candidate) => normalizeTitle(candidate))

  return uniqueTitles([
    ...candidates,
    detection.title,
    detection.normalizedTitle,
    ...normalizedCandidates,
  ])
}
