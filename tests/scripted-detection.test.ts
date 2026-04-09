import { describe, expect, it } from 'vitest'
import { buildDetectionFromScriptedSnapshot } from '../src/shared/detection/scripted-snapshot'

describe('scripted detection snapshot', () => {
  it('detects Shadow Manga reader titles from hydrated header buttons', () => {
    const detection = buildDetectionFromScriptedSnapshot({
      href: 'https://www.shadowmanga.es/reader/local/470879',
      pageTitle: 'Manga online en español | Shadow Manga',
      bodyText: 'Capitulo 12',
      faviconCandidates: [],
      titleCandidates: ['Honzuki No Gekokujou Part 4'],
      playerResponseTitle: null,
      ogTitle: 'Manga online en español | Shadow Manga',
      metaTitle: null,
      itempropName: null,
    })

    expect(detection?.title).toBe('Honzuki No Gekokujou Part 4')
    expect(detection?.mediaType).toBe('manga')
    expect(detection?.sourceSite).toBe('shadowmanga.es')
  })

  it('rejects Shadow Manga reader placeholders when no hydrated title exists', () => {
    const detection = buildDetectionFromScriptedSnapshot({
      href: 'https://www.shadowmanga.es/reader/local/470879',
      pageTitle: 'Manga online en español | Shadow Manga',
      bodyText: 'Lee manga online en español',
      faviconCandidates: [],
      titleCandidates: [],
      playerResponseTitle: null,
      ogTitle: 'Manga online en español | Shadow Manga',
      metaTitle: null,
      itempropName: null,
    })

    expect(detection).toBeNull()
  })
})
