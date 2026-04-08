import { afterEach, describe, expect, it, vi } from 'vitest'

const originalUserActivation = Object.getOwnPropertyDescriptor(navigator, 'userActivation')

function setUserActivation(isActive: boolean) {
  Object.defineProperty(navigator, 'userActivation', {
    configurable: true,
    value: { isActive },
  })
}

describe('description translation', () => {
  afterEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    Reflect.deleteProperty(globalThis, 'Translator')
    Reflect.deleteProperty(globalThis, 'LanguageDetector')

    if (originalUserActivation) {
      Object.defineProperty(navigator, 'userActivation', originalUserActivation)
    } else {
      Reflect.deleteProperty(navigator, 'userActivation')
    }
  })

  it('keeps the original description when the locale is not Spanish', async () => {
    const { translateDescription } = await import('../src/shared/i18n/description-translation')

    await expect(translateDescription('Hello world', 'en')).resolves.toEqual({
      text: 'Hello world',
      translated: false,
    })
  })

  it('falls back to the original description when Chrome Translator is unavailable', async () => {
    const { translateDescription } = await import('../src/shared/i18n/description-translation')

    await expect(translateDescription('Hello world', 'es')).resolves.toEqual({
      text: 'Hello world',
      translated: false,
    })
  })

  it('translates descriptions to Spanish with the built-in Chrome AI APIs', async () => {
    setUserActivation(true)

    Object.assign(globalThis, {
      LanguageDetector: {
        availability: vi.fn().mockResolvedValue('available'),
        create: vi.fn().mockResolvedValue({
          ready: Promise.resolve(),
          detect: vi.fn().mockResolvedValue([
            {
              detectedLanguage: 'en',
              confidence: 0.99,
            },
          ]),
        }),
      },
      Translator: {
        availability: vi.fn().mockResolvedValue('available'),
        create: vi.fn().mockResolvedValue({
          ready: Promise.resolve(),
          translate: vi.fn().mockResolvedValue('Hola mundo'),
        }),
      },
    })

    const { translateDescription } = await import('../src/shared/i18n/description-translation')

    await expect(translateDescription('Hello world', 'es')).resolves.toEqual({
      text: 'Hola mundo',
      translated: true,
    })
  })
})
