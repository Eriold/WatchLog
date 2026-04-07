import type { DetectionResult, MetadataCard } from '../types'

function resolveEpisodeTotal(
  detection: DetectionResult,
  metadata?: MetadataCard,
): number | undefined {
  const metadataTotal = metadata?.episodeCount

  if (detection.episodeTotal !== undefined) {
    return detection.episode !== undefined
      ? Math.max(detection.episodeTotal, detection.episode)
      : detection.episodeTotal
  }

  if (metadataTotal !== undefined) {
    return detection.episode !== undefined
      ? Math.max(metadataTotal, detection.episode)
      : metadataTotal
  }

  return undefined
}

function resolveChapterTotal(
  detection: DetectionResult,
  metadata?: MetadataCard,
): number | undefined {
  const metadataTotal = metadata?.chapterCount

  if (detection.chapterTotal !== undefined) {
    return detection.chapter !== undefined
      ? Math.max(detection.chapterTotal, detection.chapter)
      : detection.chapterTotal
  }

  if (metadataTotal !== undefined) {
    return detection.chapter !== undefined
      ? Math.max(metadataTotal, detection.chapter)
      : metadataTotal
  }

  return undefined
}

function buildProgressLabel(
  detection: DetectionResult,
  episodeTotal?: number,
  chapterTotal?: number,
): string {
  if (detection.season !== undefined && detection.episode !== undefined) {
    return `S${detection.season} ${detection.episode}${episodeTotal ? `/${episodeTotal}` : ''}`
  }

  if (detection.episode !== undefined) {
    return `Ep ${detection.episode}${episodeTotal ? `/${episodeTotal}` : ''}`
  }

  if (detection.chapter !== undefined) {
    return `Cap ${detection.chapter}${chapterTotal ? `/${chapterTotal}` : ''}`
  }

  if (episodeTotal !== undefined) {
    return `0/${episodeTotal}`
  }

  if (chapterTotal !== undefined) {
    return `0/${chapterTotal}`
  }

  return detection.progressLabel
}

export function hydrateDetectionWithMetadata(
  detection: DetectionResult,
  metadata?: MetadataCard,
): DetectionResult {
  const episodeTotal = resolveEpisodeTotal(detection, metadata)
  const chapterTotal = resolveChapterTotal(detection, metadata)

  return {
    ...detection,
    mediaType: metadata?.mediaType ?? detection.mediaType,
    episodeTotal,
    chapterTotal,
    progressLabel: buildProgressLabel(detection, episodeTotal, chapterTotal),
  }
}
