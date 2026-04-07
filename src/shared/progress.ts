import type { CatalogEntry, ProgressState } from './types'

interface ProgressCatalogCounts {
  episodeCount?: CatalogEntry['episodeCount']
  chapterCount?: CatalogEntry['chapterCount']
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
