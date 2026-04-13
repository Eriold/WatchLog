/** Renders the main capture card when the popup has a valid detection to inspect and save. */
import { getLocalizedMediaTypeLabel } from '../../shared/i18n/helpers'
import { normalizeTitle } from '../../shared/utils/normalize'
import { CustomSelect } from '../../shared/ui/CustomSelect'
import type { DetectionResult, LibraryEntry } from '../../shared/types'
import type { PopupPosterCandidate } from '../popup-types'
import type { PopupTranslate } from '../utils/popup-helpers'
import { CheckIcon, HeartIcon, JumpToLibraryIcon, LaunchIcon } from './PopupIcons'

interface PopupSelectOption {
  value: string
  label: string
}

interface PopupCaptureSectionProps {
  availableLists: PopupSelectOption[]
  busy: boolean
  captureInitials: string
  captureProgressPercent: number
  currentListLabel: string
  detection: DetectionResult
  detectionProgressLabel: string
  fallbackCapturePoster: string
  favorite: boolean
  matchedLibraryEntry: LibraryEntry | null
  message: string
  onChangeProgress: (value: string) => void
  onOpenLibrary: () => void
  onOpenMatchedEntry: () => void
  onSave: () => void
  onSelectList: (value: string) => void
  onSelectPoster: (url: string) => void
  onSelectSuggestedTitle: (title: string) => void
  onToggleFavorite: () => void
  popupOtherTitles: string[]
  posterCandidates: PopupPosterCandidate[]
  saveButtonLabel: string
  saveState: 'idle' | 'saved'
  selectedList: string
  selectedPosterCandidateUrl: string | null
  selectedUnofficialPoster: string | null
  shouldShowUnofficialPosterUI: boolean
  sourceHost: string
  t: PopupTranslate
  titleSuggestions: string[]
}

export function PopupCaptureSection({
  availableLists,
  busy,
  captureInitials,
  captureProgressPercent,
  currentListLabel,
  detection,
  detectionProgressLabel,
  fallbackCapturePoster,
  favorite,
  matchedLibraryEntry,
  message,
  onChangeProgress,
  onOpenLibrary,
  onOpenMatchedEntry,
  onSave,
  onSelectList,
  onSelectPoster,
  onSelectSuggestedTitle,
  onToggleFavorite,
  popupOtherTitles,
  posterCandidates,
  saveButtonLabel,
  saveState,
  selectedList,
  selectedPosterCandidateUrl,
  selectedUnofficialPoster,
  shouldShowUnofficialPosterUI,
  sourceHost,
  t,
  titleSuggestions,
}: PopupCaptureSectionProps) {
  return (
    <section className="popup-hero">
      <div className="popup-heading-row">
        <div>
          <p className="eyebrow">{t('popup.currentCapture')}</p>
          <h1 className="popup-title">{t('popup.captureCurrentTab')}</h1>
        </div>
        <span className="section-chip">{sourceHost}</span>
      </div>

      <p className="muted popup-message">{message}</p>

      <article className="capture-card">
        <div className="capture-art">
          <div className="capture-art-surface">
            <img className="capture-art-image" src={fallbackCapturePoster} alt={`${detection.title} poster`} />
            <span className="capture-art-overlay" />
            {selectedUnofficialPoster ? (
              <span className="capture-poster-badge">{t('popup.posterUnofficial')}</span>
            ) : null}
            <span className="capture-site">{detection.sourceSite}</span>
            <strong className="capture-initials">{captureInitials}</strong>
            <img
              className="capture-favicon-badge"
              src={detection.favicon}
              alt={`${sourceHost} favicon`}
              onError={(event) => {
                event.currentTarget.src = '/icons/favicon-16x16.png'
              }}
            />
          </div>
        </div>

        <div className="capture-body">
          <div className="capture-body-topline">
            <span className="capture-host">{sourceHost}</span>
            <button
              className={`favorite-icon-button ${favorite ? 'is-active' : ''}`}
              type="button"
              aria-label={favorite ? t('popup.removeFromFavorites') : t('popup.addToFavorites')}
              aria-pressed={favorite}
              onClick={onToggleFavorite}
            >
              <HeartIcon filled={favorite} />
            </button>
          </div>

          <div className="popup-section">
            <p className="label popup-compact-label">{t('popup.titleLabel')}</p>
            <div className="popup-title-panel">
              <div className="popup-title-header">
                <strong className="popup-title-value" title={detection.title}>
                  {detection.title}
                </strong>
                {matchedLibraryEntry ? (
                  <button
                    className="popup-title-jump"
                    type="button"
                    aria-label={t('popup.openMatchedInLibrary')}
                    title={t('popup.openMatchedInLibrary')}
                    onClick={onOpenMatchedEntry}
                  >
                    <JumpToLibraryIcon />
                  </button>
                ) : null}
              </div>

              {popupOtherTitles.length > 0 ? (
                <div className="popup-title-alias-block">
                  <p className="popup-title-alias-label">{t('popup.otherTitles')}</p>
                  <div className="popup-title-alias-list">
                    {popupOtherTitles.map((title) => (
                      <span key={title} className="popup-title-alias-chip" title={title}>
                        {title}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {titleSuggestions.length > 1 ? (
                <div className="popup-title-suggestion-block">
                  <p className="popup-title-alias-label">{'Sugerencias de t\u00edtulo'}</p>
                  <div className="popup-title-suggestion-list">
                    {titleSuggestions.map((title) => {
                      const isActive = normalizeTitle(title) === normalizeTitle(detection.title)

                      return (
                        <button
                          key={title}
                          className={`popup-title-suggestion-chip ${isActive ? 'is-active' : ''}`}
                          type="button"
                          onClick={() => onSelectSuggestedTitle(title)}
                          title={title}
                        >
                          <span className="popup-title-suggestion-text">{title}</span>
                          {isActive ? (
                            <span className="popup-title-suggestion-current">Actual</span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {shouldShowUnofficialPosterUI ? (
            <div className="popup-section">
              <div className="popup-unofficial-copy">
                <span className="popup-unofficial-pill">{t('popup.posterUnofficial')}</span>
                <p className="popup-unofficial-message">{t('popup.posterMetadataMissing')}</p>
              </div>
              <div className="popup-poster-picker">
                {posterCandidates.map((candidate) => (
                  <button
                    key={candidate.url}
                    className={`popup-poster-option ${
                      selectedPosterCandidateUrl === candidate.url ? 'is-selected' : ''
                    }`}
                    type="button"
                    onClick={() => onSelectPoster(candidate.url)}
                  >
                    <img className="popup-poster-option-image" src={candidate.url} alt={candidate.label} />
                    <span className="popup-poster-option-label">{candidate.label}</span>
                  </button>
                ))}
              </div>
              <p className="popup-poster-hint">{t('popup.posterPickerHint')}</p>
            </div>
          ) : null}

          <div className="capture-progress-block">
            <div className="capture-progress-copy">
              <span>
                {captureProgressPercent > 0
                  ? t('popup.completePercent', { percent: captureProgressPercent })
                  : t('popup.awaitingProgress')}
              </span>
              <span>{detectionProgressLabel}</span>
            </div>
            <div className="capture-progress-track">
              <div className="capture-progress-value" style={{ width: `${captureProgressPercent}%` }} />
            </div>
          </div>

          <div className="status-row capture-status-row">
            <span className="status-pill">{getLocalizedMediaTypeLabel(detection.mediaType, t)}</span>
            <span className="status-pill">{currentListLabel}</span>
            <span className="status-pill status-pill-progress">{detectionProgressLabel}</span>
          </div>

          <div className="popup-grid capture-controls">
            <div className="control-panel">
              <label className="label popup-compact-label">{t('popup.listLabel')}</label>
              <CustomSelect value={selectedList} onChange={onSelectList} options={availableLists} />
            </div>

            <div className="control-panel">
              <label className="label popup-compact-label" htmlFor="progress">
                {t('popup.progressLabel')}
              </label>
              <input
                id="progress"
                className="field"
                value={detection.progressLabel}
                onChange={(event) => onChangeProgress(event.target.value)}
              />
            </div>
          </div>

          <a className="source-panel" href={detection.url} target="_blank" rel="noreferrer" title={detection.url}>
            <div className="source-main">
              <img
                className="source-favicon"
                src={detection.favicon}
                alt={`${sourceHost} favicon`}
                onError={(event) => {
                  event.currentTarget.src = '/icons/favicon-16x16.png'
                }}
              />
              <div className="source-copy">
                <span className="source-label">{t('popup.capturedLink')}</span>
                <strong className="source-host">{sourceHost}</strong>
              </div>
            </div>
            <span className="link-chip">
              <LaunchIcon />
              {t('common.open')}
            </span>
          </a>
        </div>
      </article>

      <div className="popup-footer popup-primary-actions">
        <button
          className={`button popup-save-button ${saveState === 'saved' ? 'is-saved' : ''}`}
          type="button"
          disabled={busy}
          onClick={onSave}
        >
          {saveState === 'saved' ? (
            <span className="popup-save-button-content" aria-live="polite">
              <CheckIcon />
              <span>{saveButtonLabel}</span>
            </span>
          ) : (
            saveButtonLabel
          )}
        </button>
        <button className="button secondary" type="button" onClick={onOpenLibrary}>
          {t('popup.openFullLibrary')}
        </button>
      </div>
    </section>
  )
}
