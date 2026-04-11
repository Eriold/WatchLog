import { esCommonTranslations } from './es/common'
import { esLibraryTranslations } from './es/library'
import { esOptionsTranslations } from './es/options'
import { esPopupTranslations } from './es/popup'

export const esTranslations = {
  ...esCommonTranslations,
  ...esPopupTranslations,
  ...esLibraryTranslations,
  ...esOptionsTranslations,
} as const
