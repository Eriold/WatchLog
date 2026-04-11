import {
  createProgressState,
  createSourceEntry,
  dedupeHistory,
  normalizeEntryProgress,
} from './shared'
import type {
  ActivityEntry,
  CatalogEntry,
  DetectionResult,
  LibraryEntry,
  UpdateEntryInput,
  WatchLogSnapshot,
} from '../../../shared/types'
import { nowIso } from '../../../shared/utils/time'

export class ActivityRepository {
  buildEntry(snapshot: WatchLogSnapshot, catalogId: string): LibraryEntry | null {
    const catalog = snapshot.catalog.find((item) => item.id === catalogId)
    const activity = snapshot.activity.find((item) => item.catalogId === catalogId)

    if (!catalog || !activity) {
      return null
    }

    return { catalog, activity }
  }

  saveDetectionActivity(params: {
    snapshot: WatchLogSnapshot
    catalog: CatalogEntry
    detection: DetectionResult
    listId: string
    favorite?: boolean
  }): ActivityEntry {
    const { snapshot, catalog, detection, listId, favorite } = params
    const source = createSourceEntry(detection)
    const existingActivity = snapshot.activity.find((item) => item.catalogId === catalog.id)

    return existingActivity
      ? {
          ...existingActivity,
          status: listId,
          favorite: favorite ?? existingActivity.favorite,
          currentProgress: normalizeEntryProgress(createProgressState(detection), listId, catalog),
          lastSource: source,
          sourceHistory: dedupeHistory(existingActivity.sourceHistory, source),
          updatedAt: nowIso(),
        }
      : {
          catalogId: catalog.id,
          status: listId,
          favorite: favorite ?? false,
          currentProgress: normalizeEntryProgress(createProgressState(detection), listId, catalog),
          lastSource: source,
          sourceHistory: [source],
          manualNotes: '',
          tags: [],
          createdAt: nowIso(),
          updatedAt: nowIso(),
        }
  }

  mergeDetectionActivity(
    snapshot: WatchLogSnapshot,
    catalog: CatalogEntry,
    updatedActivity: ActivityEntry,
  ): ActivityEntry[] {
    const existingActivity = snapshot.activity.find((item) => item.catalogId === catalog.id)

    return existingActivity
      ? snapshot.activity.map((item) => (item.catalogId === catalog.id ? updatedActivity : item))
      : [...snapshot.activity, updatedActivity]
  }

  updateEntryActivity(
    activity: ActivityEntry,
    catalog: Pick<CatalogEntry, 'episodeCount' | 'chapterCount'>,
    input: UpdateEntryInput,
  ): ActivityEntry {
    const nextStatus = input.listId ?? activity.status
    const nextProgress = input.progress
      ? {
          ...activity.currentProgress,
          ...input.progress,
          progressText:
            input.progress.progressText ?? activity.currentProgress.progressText,
        }
      : activity.currentProgress

    return {
      ...activity,
      status: nextStatus,
      favorite: input.favorite ?? activity.favorite,
      manualNotes: input.manualNotes ?? activity.manualNotes,
      currentProgress: normalizeEntryProgress(nextProgress, nextStatus, catalog),
      updatedAt: nowIso(),
    }
  }

  reassignList(
    activity: ActivityEntry[],
    sourceListId: string,
    fallbackListId: string,
  ): ActivityEntry[] {
    return activity.map((entry) =>
      entry.status === sourceListId
        ? {
            ...entry,
            status: fallbackListId,
            updatedAt: nowIso(),
          }
        : entry,
    )
  }
}
