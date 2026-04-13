/** Contains sidepanel view bootstrap and labeling helpers derived from navigation and i18n. */
import { EXPLORER_TAB_ID } from '../../shared/constants'
import type { I18nValue } from '../../shared/i18n/context'
import {
  getLocalizedListLabel,
} from '../../shared/i18n/helpers'
import { parseLibraryNavigationTarget } from '../../shared/navigation'
import type { LibraryEntry, MetadataCard, WatchLogSnapshot } from '../../shared/types'
import { ALL_TITLES_VIEW_ID, FAVORITES_VIEW_ID } from '../constants'
import type { InitialLibrarySelection } from '../types'

export function getInitialSnapshot(): WatchLogSnapshot {
  return { catalog: [], activity: [], lists: [] }
}

export function getInitialLibrarySelection(): InitialLibrarySelection {
  if (typeof window === 'undefined') {
    return { viewId: ALL_TITLES_VIEW_ID, catalogId: null, query: '' }
  }

  const target = parseLibraryNavigationTarget(window.location.search)
  return {
    viewId: target.viewId ?? ALL_TITLES_VIEW_ID,
    catalogId: target.catalogId,
    query: target.query ?? '',
  }
}

export function getViewCount(
  viewId: string,
  entries: LibraryEntry[],
  explorerItems: MetadataCard[],
): number {
  if (viewId === ALL_TITLES_VIEW_ID) return entries.length
  if (viewId === FAVORITES_VIEW_ID) return entries.filter((entry) => entry.activity.favorite).length
  if (viewId === EXPLORER_TAB_ID) return explorerItems.length
  return entries.filter((entry) => entry.activity.status === viewId).length
}

export function getViewTitle(
  viewId: string,
  snapshot: WatchLogSnapshot,
  t: I18nValue['t'],
): string {
  if (viewId === ALL_TITLES_VIEW_ID) return t('views.allTitles')
  if (viewId === FAVORITES_VIEW_ID) return t('views.favorites')
  if (viewId === EXPLORER_TAB_ID) return t('views.explorer')
  return getLocalizedListLabel(snapshot.lists, viewId, t)
}

export function getViewDescription(viewId: string, t: I18nValue['t']): string {
  if (viewId === ALL_TITLES_VIEW_ID) return t('library.viewDescription.allTitles')
  if (viewId === 'watching') return t('library.viewDescription.watching')
  if (viewId === 'completed') return t('library.viewDescription.completed')
  if (viewId === FAVORITES_VIEW_ID) return t('library.viewDescription.favorites')
  if (viewId === EXPLORER_TAB_ID) return t('library.viewDescription.explorer')
  return t('library.viewDescription.custom')
}
