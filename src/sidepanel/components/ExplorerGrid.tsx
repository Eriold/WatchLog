/** Renders explorer results cards with save/open actions and source metadata. */
import { getTemporaryPoster } from '../../shared/mock-posters'
import type { I18nValue } from '../../shared/i18n/context'
import type { LibraryEntry, MetadataCard, WatchLogSnapshot } from '../../shared/types'
import { TranslatedDescription } from '../../shared/ui/TranslatedDescription'
import {
  formatCommunityScore,
  getExplorerCardSeasonBadge,
  getExplorerSourceLabel,
  getMediaTypeBadgeClass,
} from '../utils/library-helpers'
import { getLocalizedListLabel, getLocalizedMediaTypeLabel } from '../../shared/i18n/helpers'

type ExplorerGridProps = {
  defaultSaveListId: string
  explorerItems: MetadataCard[]
  explorerMatchedEntries: Map<string, LibraryEntry | null>
  locale: I18nValue['locale']
  onExplorerAdd: (item: MetadataCard, listId: string) => void
  onOpenExistingExplorerEntry: (entry: LibraryEntry) => void
  onSelectExplorerItem: (itemId: string) => void
  selectedExplorerIsSavedInSelectedList: boolean
  selectedExplorerItem: MetadataCard | null
  selectedExplorerMatch: LibraryEntry | null
  selectedExplorerSaveListId: string
  snapshot: WatchLogSnapshot
  t: I18nValue['t']
}

export function ExplorerGrid({
  defaultSaveListId,
  explorerItems,
  explorerMatchedEntries,
  locale,
  onExplorerAdd,
  onOpenExistingExplorerEntry,
  onSelectExplorerItem,
  selectedExplorerIsSavedInSelectedList,
  selectedExplorerItem,
  selectedExplorerMatch,
  selectedExplorerSaveListId,
  snapshot,
  t,
}: ExplorerGridProps) {
  return (
    <section className="library-grid explorer-grid">
      {explorerItems.map((item) => {
        const existingEntry = explorerMatchedEntries.get(item.id) ?? null
        const seasonBadge = getExplorerCardSeasonBadge(item)
        const score = formatCommunityScore(item.score)

        return (
          <article
            className={`library-card explorer-card ${selectedExplorerItem?.id === item.id ? 'is-selected' : ''}`}
            key={item.id}
            onClick={() => onSelectExplorerItem(item.id)}
          >
            <div className="library-card-poster-wrap">
              <img className="library-card-poster" src={item.poster ?? getTemporaryPoster(item.normalizedTitle)} alt={item.title} />
              <span className="library-card-overlay" />
              {seasonBadge ? <span className="library-card-season-badge">{seasonBadge}</span> : null}
              <div className="library-card-badges">
                <div className="library-card-badge-group">
                  <span className={`media-badge ${getMediaTypeBadgeClass(item.mediaType)}`}>
                    {getLocalizedMediaTypeLabel(item.mediaType, t)}
                  </span>
                </div>
                {score ? <span className="score-badge">{score}</span> : null}
              </div>
            </div>

            <div className="library-card-body">
              <div>
                <h3 className="library-card-title">{item.title}</h3>
                <p className="library-card-source">{getExplorerSourceLabel(item, t)}</p>
                {item.sourceUrl ? (
                  <a
                    className="library-card-source-link"
                    href={item.sourceUrl}
                    rel="noreferrer"
                    target="_blank"
                    onClick={(event) => event.stopPropagation()}
                    title={item.sourceUrl}
                  >
                    {t('library.openSource')}
                  </a>
                ) : null}
              </div>

              <div className="genre-row">
                {item.genres.slice(0, 3).map((genre) => (
                  <span className="genre-chip" key={genre}>{genre}</span>
                ))}
              </div>

              <TranslatedDescription
                className="library-card-description"
                emptyFallback={t('library.noMetadataYet')}
                locale={locale}
                t={t}
                text={item.description}
              />

              {existingEntry ? (
                <p
                  className="explorer-existing-link"
                  onClick={(event) => {
                    event.stopPropagation()
                    onOpenExistingExplorerEntry(existingEntry)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      event.stopPropagation()
                      onOpenExistingExplorerEntry(existingEntry)
                    }
                  }}
                  role="link"
                  tabIndex={0}
                >
                  {t('library.addedInList', { label: getLocalizedListLabel(snapshot.lists, existingEntry.activity.status, t) })}
                </p>
              ) : selectedExplorerItem?.id === item.id && selectedExplorerIsSavedInSelectedList && selectedExplorerMatch ? (
                <button className="button secondary" type="button" onClick={(event) => {
                  event.stopPropagation()
                  onOpenExistingExplorerEntry(selectedExplorerMatch)
                }}>
                  {t('library.savedInList', { label: getLocalizedListLabel(snapshot.lists, selectedExplorerMatch.activity.status, t) })}
                </button>
              ) : selectedExplorerItem?.id === item.id ? (
                <button className="button" type="button" onClick={(event) => {
                  event.stopPropagation()
                  onExplorerAdd(item, selectedExplorerSaveListId)
                }}>
                  {t('common.save')}
                </button>
              ) : (
                <button className="button" type="button" onClick={(event) => {
                  event.stopPropagation()
                  onExplorerAdd(item, defaultSaveListId)
                }}>
                  {t('library.addToLibrary')}
                </button>
              )}
            </div>
          </article>
        )
      })}
    </section>
  )
}
