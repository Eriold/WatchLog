import type { CatalogEntry, DetectionResult, ProgressState } from './types'

interface ProgressCatalogCounts {
  episodeCount?: CatalogEntry['episodeCount']
  chapterCount?: CatalogEntry['chapterCount']
}

export interface StructuredProgressControl {
  kind: 'episode' | 'chapter'
  current: number
  total: number
  season?: number
}

export function getResolvedProgressState(
  progress: ProgressState,
  status: string,
  counts?: ProgressCatalogCounts,
): ProgressState {
  const episodeTotal = progress.episodeTotal ?? counts?.episodeCount
  const chapterTotal = progress.chapterTotal ?? counts?.chapterCount

  if (status === 'completed') {
    if (episodeTotal !== undefined) {
      return {
        ...progress,
        episode: episodeTotal,
        episodeTotal,
        chapter: undefined,
        chapterTotal: undefined,
        progressText: `${episodeTotal}/${episodeTotal}`,
      }
    }

    if (chapterTotal !== undefined) {
      return {
        ...progress,
        chapter: chapterTotal,
        chapterTotal,
        episode: undefined,
        episodeTotal: undefined,
        progressText: `${chapterTotal}/${chapterTotal}`,
      }
    }
  }

  return {
    ...progress,
    episodeTotal,
    chapterTotal,
  }
}

export function getStructuredProgressText(current: number, total: number): string {
  return `${current}/${total}`
}

export function getStructuredProgressControl(
  progress: ProgressState,
): StructuredProgressControl | null {
  if (progress.episodeTotal !== undefined) {
    return {
      kind: 'episode',
      current: progress.episode ?? 0,
      total: progress.episodeTotal,
      season: progress.season,
    }
  }

  if (progress.chapterTotal !== undefined) {
    return {
      kind: 'chapter',
      current: progress.chapter ?? 0,
      total: progress.chapterTotal,
    }
  }

  return null
}

export function buildProgressStateFromControl(
  baseProgress: ProgressState,
  status: string,
  control: StructuredProgressControl,
  value: number,
): ProgressState {
  const clamped = Math.min(control.total, Math.max(0, value))

  if (control.kind === 'episode') {
    return getResolvedProgressState(
      {
        ...baseProgress,
        season: control.season ?? baseProgress.season,
        episode: clamped,
        episodeTotal: control.total,
        progressText: getStructuredProgressText(clamped, control.total),
      },
      status,
    )
  }

  return getResolvedProgressState(
    {
      ...baseProgress,
      chapter: clamped,
      chapterTotal: control.total,
      progressText: getStructuredProgressText(clamped, control.total),
    },
    status,
  )
}

export function getProgressPercentForState(status: string, progress: ProgressState): number {
  if (status === 'completed') {
    return 100
  }

  if (progress.episode !== undefined && progress.episodeTotal && progress.episodeTotal > 0) {
    return Math.min(100, Math.max(0, Math.round((progress.episode / progress.episodeTotal) * 100)))
  }

  if (progress.chapter !== undefined && progress.chapterTotal && progress.chapterTotal > 0) {
    return Math.min(100, Math.max(0, Math.round((progress.chapter / progress.chapterTotal) * 100)))
  }

  const percentMatch = progress.progressText.match(/(\d{1,3})\s*%/)
  if (percentMatch) {
    return Math.min(100, Math.max(0, Number.parseInt(percentMatch[1], 10)))
  }

  return 0
}

export function getProgressRemainingUnits(progress: ProgressState): number | null {
  if (progress.episode !== undefined && progress.episodeTotal) {
    return Math.max(0, progress.episodeTotal - progress.episode)
  }

  if (progress.chapter !== undefined && progress.chapterTotal) {
    return Math.max(0, progress.chapterTotal - progress.chapter)
  }

  return null
}

export function getProgressCurrentValue(progress: ProgressState): string {
  if (progress.episode !== undefined) {
    return String(progress.episode).padStart(2, '0')
  }

  if (progress.chapter !== undefined) {
    return String(progress.chapter).padStart(2, '0')
  }

  return '--'
}

export function getProgressTotalValue(progress: ProgressState): string {
  if (progress.episodeTotal !== undefined) {
    return String(progress.episodeTotal).padStart(2, '0')
  }

  if (progress.chapterTotal !== undefined) {
    return String(progress.chapterTotal).padStart(2, '0')
  }

  return '--'
}

export function isDetectionAlreadyTracked(
  progress: ProgressState,
  status: string,
  detection: Pick<DetectionResult, 'season' | 'episode' | 'chapter'>,
  counts?: ProgressCatalogCounts,
): boolean {
  const resolved = getResolvedProgressState(progress, status, counts)

  if (detection.episode !== undefined && resolved.episode !== undefined) {
    if (
      detection.season !== undefined &&
      resolved.season !== undefined &&
      detection.season !== resolved.season
    ) {
      return false
    }

    return resolved.episode >= detection.episode
  }

  if (detection.chapter !== undefined && resolved.chapter !== undefined) {
    return resolved.chapter >= detection.chapter
  }

  return false
}
