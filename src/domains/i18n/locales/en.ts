import { enCommonTranslations } from './en/common'
import { enLibraryTranslations } from './en/library'
import { enOptionsTranslations } from './en/options'
import { enPopupTranslations } from './en/popup'

export const enTranslations = {
  ...enCommonTranslations,
  ...enPopupTranslations,
  ...enLibraryTranslations,
  ...enOptionsTranslations,
} as const
