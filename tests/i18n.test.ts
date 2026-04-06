import { describe, expect, it } from 'vitest'
import {
  getLocalizedListDefinitionLabel,
  getLocalizedListLabel,
  getSortedLocalizedLists,
} from '../src/shared/i18n/helpers'
import { resolveLocale, translate } from '../src/shared/i18n/translations'
import type { WatchListDefinition } from '../src/shared/types'

const lists: WatchListDefinition[] = [
  { id: 'library', label: 'Library', kind: 'system' },
  { id: 'watching', label: 'Watching', kind: 'system' },
  { id: 'completed', label: 'Finished', kind: 'system' },
  { id: 'weekend', label: 'Weekend binge', kind: 'custom' },
]

describe('i18n helpers', () => {
  it('resolves browser locale safely', () => {
    expect(resolveLocale('es-CO')).toBe('es')
    expect(resolveLocale('en-US')).toBe('en')
    expect(resolveLocale('pt-BR')).toBe('en')
    expect(resolveLocale(null)).toBe('en')
  })

  it('localizes system list labels but preserves custom labels', () => {
    const tEs = (key: Parameters<typeof translate>[1]) => translate('es', key)

    expect(getLocalizedListLabel(lists, 'watching', tEs)).toBe('Viendo')
    expect(getLocalizedListLabel(lists, 'weekend', tEs)).toBe('Weekend binge')
    expect(getLocalizedListDefinitionLabel(lists[0], tEs)).toBe('Biblioteca')
    expect(getLocalizedListDefinitionLabel(lists[3], tEs)).toBe('Weekend binge')
  })

  it('sorts localized lists alphabetically', () => {
    const tEs = (key: Parameters<typeof translate>[1]) => translate('es', key)

    const sorted = getSortedLocalizedLists(lists, 'es', tEs).map((list) =>
      getLocalizedListDefinitionLabel(list, tEs),
    )

    expect(sorted).toEqual(['Biblioteca', 'Finalizado', 'Viendo', 'Weekend binge'])
  })
})
