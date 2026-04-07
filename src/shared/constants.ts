export const STORAGE_KEYS = {
  catalog: 'watchlog.catalog',
  activity: 'watchlog.activity',
  lists: 'watchlog.lists',
  detectionByTab: 'watchlog.detectionByTab',
  locale: 'watchlog.locale',
  anilistCache: 'watchlog.anilistCache',
} as const

export const SYSTEM_LISTS = [
  {
    id: 'completed',
    label: 'Finalizado',
    kind: 'system',
    description: 'Finished items.',
  },
  {
    id: 'watching',
    label: 'Viendo',
    kind: 'system',
    description: 'Items the user is actively following.',
  },
  {
    id: 'library',
    label: 'Library',
    kind: 'system',
    description: 'General library bucket for saved items.',
  },
] as const

export const EXPLORER_TAB_ID = 'explorer'
