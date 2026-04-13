/** Shows the popup fallback state when the current tab cannot produce a supported detection. */
import type { DetectionDebugInfo } from '../../shared/messages'
import type { PopupTranslate } from '../utils/popup-helpers'

interface PopupEmptyCaptureSectionProps {
  analyzing: boolean
  debug: DetectionDebugInfo
  message: string
  onOpenLibrary: () => void
  onRetryAnalysis: () => void
  t: PopupTranslate
  targetTabId: number | null
}

export function PopupEmptyCaptureSection({
  analyzing,
  debug,
  message,
  onOpenLibrary,
  onRetryAnalysis,
  t,
  targetTabId,
}: PopupEmptyCaptureSectionProps) {
  return (
    <section className="popup-hero">
      <div className="popup-heading-row">
        <div>
          <p className="eyebrow">{t('popup.currentCapture')}</p>
          <h1 className="popup-title">{t('popup.captureCurrentTab')}</h1>
        </div>
        <span className="section-chip">{t('popup.noSignal')}</span>
      </div>

      <p className="muted popup-message">{message}</p>

      <div className="empty-capture-card">
        <div className="empty-capture-copy">
          <strong>{t('popup.detectionUnavailable')}</strong>
          <p className="tiny">{t('popup.detectionHint')}</p>
        </div>
        <div className="debug-box">
          <div>
            <strong>{t('popup.debugSource')}:</strong> {debug.source}
          </div>
          <div>
            <strong>{t('popup.debugReason')}:</strong> {debug.reason ?? t('popup.none')}
          </div>
          <div>
            <strong>{t('popup.debugTab')}:</strong> {debug.tabId ?? targetTabId ?? t('common.unknown')}
          </div>
          <div className="debug-url">
            <strong>{t('popup.debugUrl')}:</strong> {debug.tabUrl ?? t('common.unknown')}
          </div>
        </div>
      </div>

      <div className="popup-footer popup-primary-actions">
        <button className="button" type="button" disabled={analyzing} onClick={onRetryAnalysis}>
          {t('popup.reanalyzeTab')}
        </button>
        <button className="button secondary" type="button" onClick={onOpenLibrary}>
          {t('popup.openFullLibrary')}
        </button>
      </div>
    </section>
  )
}
