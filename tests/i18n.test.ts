import { describe, expect, it } from 'vitest'
import {
  getLocalizedProgressLabel,
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

  it('formats explicit progress labels for episodes and seasons', () => {
    const tEn = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) =>
      translate('en', key, params)
    const tEs = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) =>
      translate('es', key, params)

    expect(
      getLocalizedProgressLabel(
        {
          episode: 2,
          episodeTotal: 13,
          progressText: 'Ep 2/13',
        },
        tEn,
      ),
    ).toBe('Episodes 2/13')

    expect(
      getLocalizedProgressLabel(
        {
          season: 2,
          episode: 1,
          episodeTotal: 10,
          progressText: 'S2 1/10',
        },
        tEs,
      ),
    ).toBe('Temporada 2 • Episodios 1/10')
  })
})
