import type { DetectionResult, MetadataCard, ProgressState } from '../types'

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
  fallbackProgressLabel?: string,
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

  return fallbackProgressLabel ?? detection.progressLabel
}

function resolveStoredTotal(
  currentTotal: number | undefined,
  storedTotal: number | undefined,
  progressValue: number | undefined,
): number | undefined {
  const total = currentTotal ?? storedTotal

  if (total === undefined) {
    return undefined
  }

  return progressValue !== undefined ? Math.max(total, progressValue) : total
}

function shouldReuseStoredProgressText(
  detection: DetectionResult,
  storedProgress: ProgressState,
  episode: number | undefined,
  chapter: number | undefined,
): boolean {
  const storedText = storedProgress.progressText.trim()
  if (!storedText) {
    return false
  }

  if (detection.episode === undefined && detection.chapter === undefined) {
    return true
  }

  const sameEpisode =
    episode !== undefined &&
    storedProgress.episode !== undefined &&
    episode === storedProgress.episode
  const sameChapter =
    chapter !== undefined &&
    storedProgress.chapter !== undefined &&
    chapter === storedProgress.chapter

  return (
    detection.episodeTotal === undefined &&
    detection.chapterTotal === undefined &&
    (sameEpisode || sameChapter)
  )
}

export function hydrateDetectionWithStoredProgress(
  detection: DetectionResult,
  storedProgress?: ProgressState,
): DetectionResult {
  if (!storedProgress) {
    return detection
  }

  const season = detection.season ?? storedProgress.season
  const episode = detection.episode ?? storedProgress.episode
  const chapter = detection.chapter ?? storedProgress.chapter
  const episodeTotal = resolveStoredTotal(
    detection.episodeTotal,
    storedProgress.episodeTotal,
    episode,
  )
  const chapterTotal = resolveStoredTotal(
    detection.chapterTotal,
    storedProgress.chapterTotal,
    chapter,
  )
  const progressLabel = shouldReuseStoredProgressText(
    detection,
    storedProgress,
    episode,
    chapter,
  )
    ? storedProgress.progressText
    : buildProgressLabel(
        {
          ...detection,
          season,
          episode,
          chapter,
        },
        episodeTotal,
        chapterTotal,
        storedProgress.progressText,
      )

  return {
    ...detection,
    season,
    episode,
    episodeTotal,
    chapter,
    chapterTotal,
    progressLabel,
  }
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
