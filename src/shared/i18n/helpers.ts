import type { MediaType, WatchListDefinition } from '../types'
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

type Translator = I18nValue['t']

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

export function formatLocalizedDate(value: string, locale: I18nValue['locale']): string {
  const languageTag = locale === 'es' ? 'es-CO' : 'en-US'
  return new Intl.DateTimeFormat(languageTag, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

export function getSortedLocalizedLists(
  lists: WatchListDefinition[],
  locale: I18nValue['locale'],
  t: Translator,
): WatchListDefinition[] {
  const languageTag = locale === 'es' ? 'es-CO' : 'en-US'
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
