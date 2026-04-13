/** Defines popup-specific state and data contracts shared by popup hooks, utilities and views. */
export interface PopupPosterCandidate {
  url: string
  label: string
  source: 'meta' | 'page'
  width?: number
  height?: number
  score: number
}

export interface CatalogImportProgressState {
  stage: 'queueing' | 'done' | 'error'
  processed: number
  total: number
  label?: string
  reason?: string
  summary?: {
    created: number
    moved: number
    reused: number
    omitted: number
  }
}

export interface PopupMessageState {
  key:
    | 'common.loading'
    | 'popup.suggestionReady'
    | 'popup.analyzeFailed'
    | 'popup.noSupportedMedia'
    | 'popup.reanalyzing'
    | 'popup.stillNoSupportedMedia'
    | 'popup.saving'
    | 'popup.savedUnder'
  params?: Record<string, string>
}
