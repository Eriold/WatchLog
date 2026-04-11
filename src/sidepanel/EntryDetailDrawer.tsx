import {
  formatLocalizedDate,
  getLocalizedListDefinitionLabel,
  getLocalizedListLabel,
  getLocalizedMediaTypeLabel,
  getLocalizedProgressLabel,
  getLocalizedPublicationStatusLabel,
  formatLocalizedFuzzyDate,
} from '../shared/i18n/helpers'
import { getTemporaryPoster } from '../shared/mock-posters'
import { isCatalogMetadataPending } from '../shared/catalog-sync'
import type { StructuredProgressControl } from '../shared/progress'
import {
  getProgressCurrentValue as getProgressCurrentValueForState,
  getProgressTotalValue as getProgressTotalValueForState,
} from '../shared/progress'
import type { I18nValue } from '../shared/i18n/context'
import type { FuzzyDate, LibraryEntry, MetadataCard, ProgressState, WatchLogSnapshot } from '../shared/types'
import { CustomSelect } from '../shared/ui/CustomSelect'
import { TranslatedDescription } from '../shared/ui/TranslatedDescription'
import type { EntryDraft } from './types'

type DetailEntryMetadata = Pick<
  MetadataCard,
  'genres' | 'publicationStatus' | 'startDate' | 'endDate'
>

type EntryDetailDrawerProps = {
  locale: I18nValue['locale']
  snapshot: WatchLogSnapshot
  t: I18nValue['t']
  selectedEntry: LibraryEntry | null
  selectedDraft: EntryDraft | null
  selectedExplorerItem: MetadataCard | null
  selectedExplorerMatch: LibraryEntry | null
  selectedEntryDisplayProgress: ProgressState | null
  selectedEntryProgressControl: StructuredProgressControl | null
  selectedEntryProgressPercent: number
  selectedEntryProgressSelectValue: string
  selectedEntryDetails: DetailEntryMetadata | null
  isEntryAniListRefreshing: boolean
  selectedExplorerSaveListId: string
  onUpdateDraft: (patch: Partial<EntryDraft>) => void
  onToggleFavorite: () => void
  onSaveEntry: () => void
  onRefreshEntryAniList: () => void
  onCloseSelectedEntry: () => void
  onCloseSelectedExplorer: () => void
  onDeleteEntry: () => void
  onOpenExistingExplorerEntry: (entry: LibraryEntry) => void
  onExplorerSaveListChange: (listId: string) => void
  onExplorerSave: (item: MetadataCard, listId: string) => void
}

const EDITABLE_MEDIA_TYPES: LibraryEntry['catalog']['mediaType'][] = [
  'anime',
  'manga',
  'manhwa',
  'manhua',
  'novel',
  'series',
  'movie',
  'video',
  'unknown',
]

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
      <path
        d="M7 7 17 17M17 7 7 17"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function getOtherTitles(
  item: Pick<MetadataCard, 'aliases'> & Pick<LibraryEntry['catalog'], 'title'>,
): string[] {
  return (item.aliases ?? []).filter((title) => title.trim() && title !== item.title)
}

function getExplorerSourceLabel(item: MetadataCard): string {
  return item.id.startsWith('anilist:') ? 'AniList' : 'Unknown'
}

function getTechnicalDateLabel(
  value: FuzzyDate | undefined,
  locale: I18nValue['locale'],
  t: I18nValue['t'],
): string {
  return formatLocalizedFuzzyDate(value, locale) ?? t('common.unknown')
}

function getProgressCurrentValue(progress: ProgressState): string {
  return getProgressCurrentValueForState(progress)
}

function getProgressTotalValue(progress: ProgressState): string {
  return getProgressTotalValueForState(progress)
}

export function EntryDetailDrawer({
  locale,
  snapshot,
  t,
  selectedEntry,
  selectedDraft,
  selectedExplorerItem,
  selectedExplorerMatch,
  selectedEntryDisplayProgress,
  selectedEntryProgressControl,
  selectedEntryProgressPercent,
  selectedEntryProgressSelectValue,
  selectedEntryDetails,
  isEntryAniListRefreshing,
  selectedExplorerSaveListId,
  onUpdateDraft,
  onToggleFavorite,
  onSaveEntry,
  onRefreshEntryAniList,
  onCloseSelectedEntry,
  onCloseSelectedExplorer,
  onDeleteEntry,
  onOpenExistingExplorerEntry,
  onExplorerSaveListChange,
  onExplorerSave,
}: EntryDetailDrawerProps) {
  const active = Boolean(selectedEntry || selectedExplorerItem)
  const selectedExplorerSavedListId = selectedExplorerMatch?.activity.status ?? null
  const selectedExplorerIsSavedInSelectedList =
    selectedExplorerSavedListId !== null &&
    selectedExplorerSavedListId === selectedExplorerSaveListId

  return (
    <aside className={`entry-detail-drawer ${active ? 'is-open' : ''}`}>
      {selectedEntry && selectedDraft ? (
        <>
          <div className="entry-detail-header">
            <div className="entry-detail-badges">
              <span className={`media-badge type-${selectedDraft.mediaType}`}>
                {getLocalizedMediaTypeLabel(selectedDraft.mediaType, t)}
              </span>
              <span className="media-badge tone-planned">
                {getLocalizedListLabel(snapshot.lists, selectedDraft.listId, t)}
              </span>
            </div>
            <button
              className={`favorite-toggle-chip ${selectedDraft.favorite ? 'is-active' : ''}`}
              type="button"
              onClick={() => void onToggleFavorite()}
            >
              {selectedDraft.favorite ? t('library.favoriteEnabled') : t('library.markFavorite')}
            </button>
          </div>

          <div className="entry-detail-body">
            <div className="entry-detail-poster-wrap">
              <div className="entry-detail-poster-glow" />
              <div className="entry-detail-poster-card">
                {isCatalogMetadataPending(selectedEntry.catalog) && !selectedEntry.catalog.poster ? (
                  <div className="entry-detail-poster entry-detail-poster-placeholder" aria-hidden="true" />
                ) : (
                  <img
                    className="entry-detail-poster"
                    src={selectedEntry.catalog.poster ?? getTemporaryPoster(selectedEntry.catalog.normalizedTitle)}
                    alt={selectedEntry.catalog.title}
                  />
                )}
                <span className="entry-detail-status-pill">
                  {getLocalizedListLabel(snapshot.lists, selectedDraft.listId, t)}
                </span>
              </div>
            </div>

            <div className="entry-detail-title-block">
              <h3 className="entry-detail-title">{selectedEntry.catalog.title}</h3>
              <p className="entry-detail-platform">
                {t('library.detectedOn', {
                  site: selectedEntry.activity.lastSource?.siteName ?? t('library.manualEntry'),
                })}
              </p>
            </div>

            {getOtherTitles(selectedEntry.catalog).length > 0 ? (
              <div className="field-card">
                <p className="library-detail-kicker">{t('library.otherTitles')}</p>
                <div className="genre-row">
                  {getOtherTitles(selectedEntry.catalog).map((title) => (
                    <span className="genre-chip" key={title}>
                      {title}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="entry-progress-module">
              <div className="entry-progress-head">
                <div className="entry-progress-main">
                  <span className="entry-progress-label">{t('library.entryProgressModule')}</span>
                  <div className="entry-progress-numbers">
                    {selectedEntryDisplayProgress ? (
                      <>
                        <strong>{getProgressCurrentValue(selectedEntryDisplayProgress)}</strong>
                        <span>/ {getProgressTotalValue(selectedEntryDisplayProgress)}</span>
                      </>
                    ) : (
                      <strong>{t('common.unknown')}</strong>
                    )}
                  </div>
                </div>
              </div>
              <div className="entry-progress-track">
                <div
                  className="entry-progress-value"
                  style={{ width: `${selectedEntryProgressPercent}%` }}
                />
              </div>
            </div>

            <div className="entry-detail-actions-stack">
              <button className="button" type="button" onClick={onSaveEntry}>
                {t('library.saveChanges')}
              </button>
              <button
                className="button secondary"
                type="button"
                disabled={isEntryAniListRefreshing}
                onClick={() => void onRefreshEntryAniList()}
              >
                {isEntryAniListRefreshing
                  ? t('library.anilistRefreshRunning')
                  : t('library.anilistRefreshAction')}
              </button>
              {selectedEntry.activity.lastSource?.url ? (
                <a
                  className="button secondary"
                  href={selectedEntry.activity.lastSource.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  {t('library.resumeSource')}
                </a>
              ) : null}
            </div>

            <div className="field-card">
              <p className="library-detail-kicker">{t('library.entryTechnicalDetails')}</p>
              <TranslatedDescription
                className="library-detail-copy"
                emptyFallback={t('library.noMetadataYet')}
                locale={locale}
                t={t}
                text={selectedEntry.catalog.description}
                appendGoogleAttribution
              />
            </div>

            <div className="entry-detail-grid">
              <div className="field-card field-card-wide">
                <label className="label" htmlFor="entry-title">
                  {t('popup.titleLabel')}
                </label>
                <input
                  id="entry-title"
                  className="field"
                  value={selectedDraft.title}
                  onChange={(event) => onUpdateDraft({ title: event.target.value })}
                />
              </div>
              <div className="field-card">
                <label className="label">{t('library.categoryTag')}</label>
                <CustomSelect
                  value={selectedDraft.mediaType}
                  onChange={(value) => onUpdateDraft({ mediaType: value as LibraryEntry['catalog']['mediaType'] })}
                  options={EDITABLE_MEDIA_TYPES.map((mediaType) => ({
                    value: mediaType,
                    label: `${t('library.typePrefix')}: ${getLocalizedMediaTypeLabel(mediaType, t)}`,
                  }))}
                />
              </div>
              <div className="field-card">
                <label className="label">{t('library.primaryList')}</label>
                <CustomSelect
                  value={selectedDraft.listId}
                  onChange={(value) => onUpdateDraft({ listId: value })}
                  options={snapshot.lists.map((list) => ({
                    value: list.id,
                    label: getLocalizedListDefinitionLabel(list, t),
                  }))}
                />
              </div>
              <div className="field-card">
                <label className="label">{t('popup.progressLabel')}</label>
                {selectedEntryProgressControl ? (
                  <CustomSelect
                    value={selectedEntryProgressSelectValue}
                    disabled={selectedDraft.listId === 'completed'}
                    onChange={(nextValue) => {
                      const nextProgressValue = Number.parseInt(nextValue, 10)
                      const value = Number.isNaN(nextProgressValue)
                        ? selectedEntryProgressControl.current
                        : nextProgressValue

                      onUpdateDraft({
                        progressValue: value,
                        progressText: `${value}/${selectedEntryProgressControl.total}`,
                      })
                    }}
                    options={Array.from(
                      { length: selectedEntryProgressControl.total + 1 },
                      (_, index) => index,
                    ).map((value) => ({
                      value: String(value),
                      label: `${value}/${selectedEntryProgressControl.total}`,
                    }))}
                  />
                ) : (
                  <input
                    id="entry-progress"
                    className="field"
                    value={selectedDraft.progressText}
                    onChange={(event) => onUpdateDraft({ progressText: event.target.value })}
                  />
                )}
              </div>
              <div className="field-card field-card-wide">
                <label className="label" htmlFor="entry-notes">
                  {t('library.notes')}
                </label>
                <textarea
                  id="entry-notes"
                  className="textarea"
                  value={selectedDraft.notes}
                  onChange={(event) => onUpdateDraft({ notes: event.target.value })}
                />
              </div>
            </div>

            <div className="field-card entry-technical-block">
              <p className="library-detail-kicker">{t('library.entryTechnicalDetails')}</p>
              <div className="entry-technical-grid">
                <div>
                  <span className="entry-technical-label">{t('library.primaryList')}</span>
                  <strong>{getLocalizedListLabel(snapshot.lists, selectedDraft.listId, t)}</strong>
                </div>
                <div>
                  <span className="entry-technical-label">{t('popup.progressLabel')}</span>
                  <strong>
                    {selectedEntryDisplayProgress
                      ? getLocalizedProgressLabel(selectedEntryDisplayProgress, t)
                      : t('common.unknown')}
                  </strong>
                </div>
                <div>
                  <span className="entry-technical-label">{t('library.publicationStatus')}</span>
                  <strong>
                    {getLocalizedPublicationStatusLabel(selectedEntryDetails?.publicationStatus, t)}
                  </strong>
                </div>
                <div>
                  <span className="entry-technical-label">{t('library.startDate')}</span>
                  <strong>{getTechnicalDateLabel(selectedEntryDetails?.startDate, locale, t)}</strong>
                </div>
                <div>
                  <span className="entry-technical-label">{t('library.endDate')}</span>
                  <strong>{getTechnicalDateLabel(selectedEntryDetails?.endDate, locale, t)}</strong>
                </div>
                <div>
                  <span className="entry-technical-label">{t('library.genresLabel')}</span>
                  <strong>
                    {selectedEntryDetails?.genres && selectedEntryDetails.genres.length > 0
                      ? selectedEntryDetails.genres.join(', ')
                      : t('library.noMetadataYet')}
                  </strong>
                </div>
                <div>
                  <span className="entry-technical-label">{t('common.search')}</span>
                  <strong>{selectedEntry.activity.lastSource?.pageTitle ?? t('common.unknown')}</strong>
                </div>
              </div>
            </div>

            <div className="field-card entry-history-block">
              <div className="entry-history-head">
                <p className="library-detail-kicker">{t('library.entryHistory')}</p>
                <button
                  className="list-settings-close"
                  type="button"
                  aria-label={t('library.entryClosePanel')}
                  onClick={onCloseSelectedEntry}
                >
                  <CloseIcon className="list-settings-close-icon" />
                </button>
              </div>
              <div className="history-table">
                {selectedEntry.activity.sourceHistory.length === 0 ? (
                  <p className="library-detail-copy">{t('library.entryNoHistory')}</p>
                ) : (
                  selectedEntry.activity.sourceHistory.map((source) => (
                    <a
                      key={source.id}
                      className="history-row"
                      href={source.url || '#'}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <div className="history-site">
                        {source.favicon ? <img src={source.favicon} alt="" /> : null}
                        <div>
                          <strong>{source.siteName}</strong>
                          <span>
                            {getLocalizedProgressLabel(
                              {
                                season: source.season,
                                episode: source.episode,
                                episodeTotal: source.episodeTotal,
                                chapter: source.chapter,
                                chapterTotal: source.chapterTotal,
                                progressText: source.progressText,
                              },
                              t,
                            )}
                          </span>
                        </div>
                      </div>
                      <span className="history-date">{formatLocalizedDate(source.detectedAt, locale)}</span>
                    </a>
                  ))
                )}
              </div>
            </div>

            <div className="field-card list-settings-section list-settings-danger">
              <p className="list-settings-action-copy">
                {t('library.deleteItemConfirmBody', { title: selectedEntry.catalog.title })}
              </p>
              <button className="button danger" type="button" onClick={onDeleteEntry}>
                {t('library.deleteItem')}
              </button>
            </div>
          </div>
        </>
      ) : selectedExplorerItem ? (
        <>
            <div className="entry-detail-header">
            <div className="entry-detail-badges">
              <span className={`media-badge type-${selectedExplorerItem.mediaType}`}>
                {getLocalizedMediaTypeLabel(selectedExplorerItem.mediaType, t)}
              </span>
              <span className="media-badge tone-planned">
                {getExplorerSourceLabel(selectedExplorerItem)}
              </span>
            </div>
            <button
              className="list-settings-close"
              type="button"
              aria-label={t('library.entryClosePanel')}
              onClick={onCloseSelectedExplorer}
            >
              <CloseIcon className="list-settings-close-icon" />
            </button>
          </div>

          <div className="entry-detail-body">
            <div className="entry-detail-poster-wrap">
              <div className="entry-detail-poster-glow" />
              <div className="entry-detail-poster-card">
                <img
                  className="entry-detail-poster"
                  src={selectedExplorerItem.poster ?? getTemporaryPoster(selectedExplorerItem.normalizedTitle)}
                  alt={selectedExplorerItem.title}
                />
                <span className="entry-detail-status-pill">
                  {getExplorerSourceLabel(selectedExplorerItem)}
                </span>
              </div>
            </div>

            <div className="entry-detail-title-block">
              <h3 className="entry-detail-title">{selectedExplorerItem.title}</h3>
              <p className="entry-detail-platform">
                {t('library.detectedOn', {
                  site: getExplorerSourceLabel(selectedExplorerItem),
                })}
              </p>
            </div>

            {getOtherTitles(selectedExplorerItem).length > 0 ? (
              <div className="field-card">
                <p className="library-detail-kicker">{t('library.otherTitles')}</p>
                <div className="genre-row">
                  {getOtherTitles(selectedExplorerItem).map((title) => (
                    <span className="genre-chip" key={title}>
                      {title}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="field-card">
              <p className="library-detail-kicker">{t('library.entryTechnicalDetails')}</p>
              <TranslatedDescription
                className="library-detail-copy"
                emptyFallback={t('library.noMetadataYet')}
                locale={locale}
                t={t}
                text={selectedExplorerItem.description}
                appendGoogleAttribution
              />
            </div>

            <div className="field-card">
              <label className="label">{t('library.primaryList')}</label>
              <CustomSelect
                value={selectedExplorerSaveListId}
                onChange={onExplorerSaveListChange}
                options={snapshot.lists.map((list) => ({
                  value: list.id,
                  label: getLocalizedListDefinitionLabel(list, t),
                }))}
              />
            </div>

            <div className="entry-detail-actions-stack">
              <button
                className={`button ${selectedExplorerIsSavedInSelectedList ? 'secondary' : ''}`.trim()}
                type="button"
                onClick={() => {
                  if (selectedExplorerIsSavedInSelectedList && selectedExplorerMatch) {
                    onOpenExistingExplorerEntry(selectedExplorerMatch)
                    return
                  }

                  onExplorerSave(selectedExplorerItem, selectedExplorerSaveListId)
                }}
              >
                {selectedExplorerIsSavedInSelectedList && selectedExplorerMatch
                  ? t('library.savedInList', {
                      label: getLocalizedListLabel(
                        snapshot.lists,
                        selectedExplorerMatch.activity.status,
                        t,
                      ),
                    })
                  : t('common.save')}
              </button>
            </div>

            <div className="field-card entry-technical-block">
              <p className="library-detail-kicker">{t('library.entryTechnicalDetails')}</p>
              <div className="entry-technical-grid">
                <div>
                  <span className="entry-technical-label">{t('library.metaSource')}</span>
                  <strong>{getExplorerSourceLabel(selectedExplorerItem)}</strong>
                </div>
                <div>
                  <span className="entry-technical-label">{t('library.publicationStatus')}</span>
                  <strong>
                    {getLocalizedPublicationStatusLabel(selectedExplorerItem.publicationStatus, t)}
                  </strong>
                </div>
                <div>
                  <span className="entry-technical-label">{t('library.startDate')}</span>
                  <strong>{getTechnicalDateLabel(selectedExplorerItem.startDate, locale, t)}</strong>
                </div>
                <div>
                  <span className="entry-technical-label">{t('library.endDate')}</span>
                  <strong>{getTechnicalDateLabel(selectedExplorerItem.endDate, locale, t)}</strong>
                </div>
                <div>
                  <span className="entry-technical-label">{t('library.genresLabel')}</span>
                  <strong>
                    {selectedExplorerItem.genres.length > 0
                      ? selectedExplorerItem.genres.join(', ')
                      : t('library.noMetadataYet')}
                  </strong>
                </div>
                <div>
                  <span className="entry-technical-label">{t('library.releaseYear')}</span>
                  <strong>{selectedExplorerItem.releaseYear ?? t('common.unknown')}</strong>
                </div>
                <div>
                  <span className="entry-technical-label">{t('library.scoreLabel')}</span>
                  <strong>
                    {selectedExplorerItem.score !== undefined ? String(selectedExplorerItem.score) : t('common.unknown')}
                  </strong>
                </div>
                <div>
                  <span className="entry-technical-label">{t('library.episodeCount')}</span>
                  <strong>{selectedExplorerItem.episodeCount ?? t('common.unknown')}</strong>
                </div>
                <div>
                  <span className="entry-technical-label">{t('library.chapterCount')}</span>
                  <strong>{selectedExplorerItem.chapterCount ?? t('common.unknown')}</strong>
                </div>
                <div>
                  <span className="entry-technical-label">{t('library.seasonCount')}</span>
                  <strong>{selectedExplorerItem.seasonCount ?? t('common.unknown')}</strong>
                </div>
                <div>
                  <span className="entry-technical-label">{t('library.runtimeMinutes')}</span>
                  <strong>
                    {selectedExplorerItem.runtime !== undefined
                      ? `${selectedExplorerItem.runtime} min`
                      : t('common.unknown')}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </aside>
  )
}
