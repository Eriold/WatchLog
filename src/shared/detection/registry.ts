import type { DetectionAdapter, DetectionResult } from '../types'
import { createDetectionContext } from './helpers'
import { genericAdapter } from './adapters/generic'
import { maxAdapter } from './adapters/max'
import { netflixAdapter } from './adapters/netflix'
import { primeAdapter } from './adapters/prime'
import { jkanimeAdapter } from './adapters/jkanime'
import { shadowMangaAdapter } from './adapters/shadowmanga'
import { youtubeAdapter } from './adapters/youtube'

const adapters: DetectionAdapter[] = [
  netflixAdapter,
  maxAdapter,
  primeAdapter,
  jkanimeAdapter,
  youtubeAdapter,
  shadowMangaAdapter,
  genericAdapter,
]

export function detectCurrentDocument(
  document: Document,
  href = window.location.href,
): DetectionResult | null {
  const context = createDetectionContext(document, href)
  const matchingAdapters = adapters.filter((adapter) => adapter.matches(context.url))

  for (const adapter of matchingAdapters) {
    const result = adapter.detect(context)
    if (result?.title) {
      return result
    }
  }

  return null
}

export function getRegisteredAdapters(): DetectionAdapter[] {
  return adapters
}
