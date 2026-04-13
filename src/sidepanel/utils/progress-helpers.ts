/** Contains sidepanel progress and draft helpers used by cards, drawer editing, and persistence. */
import type { I18nValue } from '../../shared/i18n/context'
import { getLocalizedProgressLabel } from '../../shared/i18n/helpers'
import {
  buildProgressStateFromControl,
  getProgressPercentForState,
  getResolvedProgressState,
  getStructuredProgressControl,
} from '../../shared/progress'
import type { LibraryEntry } from '../../shared/types'
import type { EntryDraft } from '../types'

export function getEntryDisplayProgress(entry: LibraryEntry) {
  return getResolvedProgressState(entry.activity.currentProgress, entry.activity.status, {
    episodeCount: entry.catalog.episodeCount,
    chapterCount: entry.catalog.chapterCount,
  })
}

export function getProgressPercent(entry: LibraryEntry): number {
  return getProgressPercentForState(entry.activity.status, getEntryDisplayProgress(entry))
}

export function getEntryDisplayProgressText(entry: LibraryEntry, t: I18nValue['t']): string {
  return getLocalizedProgressLabel(getEntryDisplayProgress(entry), t)
}

export function createEntryDraft(entry: LibraryEntry): EntryDraft {
  const progress = getEntryDisplayProgress(entry)
  const control = getStructuredProgressControl(progress)

  return {
    title: entry.catalog.title,
    mediaType: entry.catalog.mediaType,
    notes: entry.activity.manualNotes,
    progressText: progress.progressText,
    progressValue: control?.current ?? null,
    listId: entry.activity.status,
    favorite: entry.activity.favorite,
  }
}

export function getDraftProgressState(entry: LibraryEntry, draft: EntryDraft) {
  const baseProgress = getEntryDisplayProgress(entry)
  const control = getStructuredProgressControl(baseProgress)

  if (control) {
    const value = draft.listId === 'completed' ? control.total : draft.progressValue ?? control.current
    return buildProgressStateFromControl(baseProgress, draft.listId, control, value)
  }

  return getResolvedProgressState(
    { ...baseProgress, progressText: draft.progressText },
    draft.listId,
    {
      episodeCount: entry.catalog.episodeCount,
      chapterCount: entry.catalog.chapterCount,
    },
  )
}
