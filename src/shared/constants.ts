export const STORAGE_KEYS = {
  catalog: 'watchlog.catalog',
  activity: 'watchlog.activity',
  lists: 'watchlog.lists',
  detectionByTab: 'watchlog.detectionByTab',
} as const

export const SYSTEM_LISTS = [
  {
    id: 'watching',
    label: 'Viendo',
    kind: 'system',
    description: 'Items the user is actively following.',
  },
  {
    id: 'planned',
    label: 'Por ver',
    kind: 'system',
    description: 'Items saved for later.',
  },
  {
    id: 'completed',
    label: 'Finalizado',
    kind: 'system',
    description: 'Finished items.',
  },
  {
    id: 'paused',
    label: 'Pausado',
    kind: 'system',
    description: 'Items temporarily paused.',
  },
] as const

export const EXPLORER_TAB_ID = 'explorer'
