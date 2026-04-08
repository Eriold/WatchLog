import type {
  FuzzyDate,
  MediaType,
  ProgressState,
  PublicationStatus,
  WatchListDefinition,
} from '../types'
import type { I18nValue } from './context'
import type { TranslationKey } from './translations'

const SYSTEM_LIST_KEYS = {
  completed: 'lists.completed',
  watching: 'lists.watching',
  library: 'lists.library',
} as const satisfies Record<string, TranslationKey>

const MEDIA_TYPE_KEYS = {
  movie: 'media.movie',
  series: 'media.series',
  anime: 'media.anime',
  manga: 'media.manga',
  novel: 'media.novel',
  video: 'media.video',
  unknown: 'media.unknown',
} as const satisfies Record<MediaType, TranslationKey>

const PUBLICATION_STATUS_KEYS = {
  FINISHED: 'library.publicationStatus.finished',
  RELEASING: 'library.publicationStatus.releasing',
  NOT_YET_RELEASED: 'library.publicationStatus.notYetReleased',
  CANCELLED: 'library.publicationStatus.cancelled',
  HIATUS: 'library.publicationStatus.hiatus',
} as const satisfies Record<PublicationStatus, TranslationKey>

type Translator = I18nValue['t']

function getLanguageTag(locale: I18nValue['locale']): string {
  return locale === 'es' ? 'es-CO' : 'en-US'
}

export function getLocalizedListLabel(
  lists: WatchListDefinition[],
  listId: string,
  t: Translator,
): string {
  const list = lists.find((candidate) => candidate.id === listId)
  const systemKey = SYSTEM_LIST_KEYS[listId as keyof typeof SYSTEM_LIST_KEYS]

  if (systemKey) {
    return t(systemKey)
  }

  return list?.label ?? listId
}

export function getLocalizedListDefinitionLabel(
  list: WatchListDefinition,
  t: Translator,
): string {
  const systemKey = SYSTEM_LIST_KEYS[list.id as keyof typeof SYSTEM_LIST_KEYS]

  if (list.kind === 'system' && systemKey) {
    return t(systemKey)
  }

  return list.label
}

export function getLocalizedMediaTypeLabel(mediaType: MediaType, t: Translator): string {
  return t(MEDIA_TYPE_KEYS[mediaType] ?? 'media.unknown')
}

export function getLocalizedPublicationStatusLabel(
  status: PublicationStatus | undefined,
  t: Translator,
): string {
  if (!status) {
    return t('common.unknown')
  }

  return t(PUBLICATION_STATUS_KEYS[status])
}

export function getLocalizedProgressLabel(
  progress: Pick<
    ProgressState,
    'season' | 'episode' | 'episodeTotal' | 'chapter' | 'chapterTotal' | 'progressText'
  >,
  t: Translator,
): string {
  if (progress.season !== undefined && progress.episode !== undefined) {
    if (progress.episodeTotal !== undefined) {
      return t('progress.seasonEpisodesOfTotal', {
        season: progress.season,
        current: progress.episode,
        total: progress.episodeTotal,
      })
    }

    return t('progress.seasonEpisodeCurrent', {
      season: progress.season,
      current: progress.episode,
    })
  }

  if (progress.episode !== undefined) {
    if (progress.episodeTotal !== undefined) {
      return t('progress.episodesOfTotal', {
        current: progress.episode,
        total: progress.episodeTotal,
      })
    }

    return t('progress.episodeCurrent', {
      current: progress.episode,
    })
  }

  if (progress.chapter !== undefined) {
    if (progress.chapterTotal !== undefined) {
      return t('progress.chaptersOfTotal', {
        current: progress.chapter,
        total: progress.chapterTotal,
      })
    }

    return t('progress.chapterCurrent', {
      current: progress.chapter,
    })
  }

  if (progress.episodeTotal !== undefined) {
    return t('progress.episodesOfTotal', {
      current: 0,
      total: progress.episodeTotal,
    })
  }

  if (progress.chapterTotal !== undefined) {
    return t('progress.chaptersOfTotal', {
      current: 0,
      total: progress.chapterTotal,
    })
  }

  return progress.progressText
}

export function formatLocalizedDate(value: string, locale: I18nValue['locale']): string {
  const languageTag = getLanguageTag(locale)
  return new Intl.DateTimeFormat(languageTag, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

export function formatLocalizedFuzzyDate(
  value: FuzzyDate | undefined,
  locale: I18nValue['locale'],
): string | null {
  if (!value?.year) {
    return null
  }

  const languageTag = getLanguageTag(locale)
  const hasMonth = typeof value.month === 'number' && value.month >= 1 && value.month <= 12
  const hasDay = typeof value.day === 'number' && value.day >= 1 && value.day <= 31

  if (hasMonth && hasDay) {
    return new Intl.DateTimeFormat(languageTag, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(value.year, value.month! - 1, value.day!)))
  }

  if (hasMonth) {
    return new Intl.DateTimeFormat(languageTag, {
      year: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(value.year, value.month! - 1, 1)))
  }

  return String(value.year)
}

export function getSortedLocalizedLists(
  lists: WatchListDefinition[],
  locale: I18nValue['locale'],
  t: Translator,
): WatchListDefinition[] {
  const languageTag = getLanguageTag(locale)
  const collator = new Intl.Collator(languageTag, {
    sensitivity: 'base',
    numeric: true,
  })

  return [...lists].sort((left, right) => {
    return collator.compare(
      getLocalizedListDefinitionLabel(left, t),
      getLocalizedListDefinitionLabel(right, t),
    )
  })
}
