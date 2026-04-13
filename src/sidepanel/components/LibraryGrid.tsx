/** Renders catalog cards for saved library entries including poster, sync state, and progress indicators. */
import { getTemporaryPoster } from '../../shared/mock-posters'
import { getLocalizedListLabel, getLocalizedMediaTypeLabel } from '../../shared/i18n/helpers'
import type { I18nValue } from '../../shared/i18n/context'
import { isCatalogMetadataPending } from '../../shared/catalog-sync'
import type { LibraryEntry, WatchLogSnapshot } from '../../shared/types'
import type { CatalogSyncVisualState } from '../types'
import { SyncStatusGlyph } from './SidePanelIcons'
import { getCatalogSyncState } from '../utils/catalog-sync'
import {
  formatCommunityScore,
  getLibraryCardSeasonBadge,
  getMediaTypeBadgeClass,
} from '../utils/library-helpers'
import { getEntryDisplayProgressText, getProgressPercent } from '../utils/progress-helpers'

type LibraryGridProps = {
  filteredEntries: LibraryEntry[]
  onSelectEntry: (catalogId: string) => void
  selectedCatalogId: string | null
  snapshot: WatchLogSnapshot
  syncingCatalogIdSet: Set<string>
  t: I18nValue['t']
}

export function LibraryGrid({
  filteredEntries,
  onSelectEntry,
  selectedCatalogId,
  snapshot,
  syncingCatalogIdSet,
  t,
}: LibraryGridProps) {
  return (
    <section className="library-grid">
      {filteredEntries.map((entry) => {
        const progress = getProgressPercent(entry)
        const platform = entry.activity.lastSource?.siteName ?? t('library.manualEntry')
        const seasonBadge = getLibraryCardSeasonBadge(entry)
        const baseSyncState = getCatalogSyncState(entry.catalog)
        const syncState: CatalogSyncVisualState | null =
          syncingCatalogIdSet.has(entry.catalog.id) ? 'syncing' : baseSyncState
        const showPendingPlaceholder =
          (baseSyncState === 'pending' || syncState === 'syncing') && !entry.catalog.poster
        const score = formatCommunityScore(entry.catalog.score)

        return (
          <article
            key={entry.catalog.id}
            className={`library-card ${selectedCatalogId === entry.catalog.id ? 'is-selected' : ''}`}
            onClick={() => onSelectEntry(entry.catalog.id)}
          >
            <div className="library-card-poster-wrap">
              {showPendingPlaceholder ? (
                <div className="library-card-poster library-card-poster-placeholder" aria-hidden="true" />
              ) : (
                <img
                  className="library-card-poster"
                  src={entry.catalog.poster ?? getTemporaryPoster(entry.catalog.normalizedTitle)}
                  alt={entry.catalog.title}
                />
              )}
              <span className="library-card-overlay" />
              {seasonBadge ? <span className="library-card-season-badge">{seasonBadge}</span> : null}
              <div className="library-card-badges">
                <div className="library-card-badge-group">
                  <span className={`media-badge ${getMediaTypeBadgeClass(entry.catalog.mediaType)}`}>
                    {getLocalizedMediaTypeLabel(entry.catalog.mediaType, t)}
                  </span>
                  {entry.activity.favorite ? <span className="favorite-badge">{t('common.favorite')}</span> : null}
                </div>
                <div className="library-card-status-group">
                  {syncState ? (
                    <span className={`catalog-sync-badge is-${syncState}`}>
                      <SyncStatusGlyph className="catalog-sync-icon" state={syncState} />
                    </span>
                  ) : null}
                  {score ? <span className="score-badge">{score}</span> : null}
                </div>
              </div>
              <div className="library-card-progress">
                <div className="library-card-progress-copy">
                  <span>{entry.activity.status === 'completed' ? t('library.completedTrack') : t('library.activeTrack')}</span>
                  <span>{progress > 0 ? `${progress}%` : getEntryDisplayProgressText(entry, t)}</span>
                </div>
                <div className="library-card-progress-track">
                  <div className="library-card-progress-value" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>

            <div className="library-card-body">
              <div>
                <h3 className="library-card-title">{entry.catalog.title}</h3>
                <p className="library-card-source">{platform}</p>
              </div>
              <div className="genre-row">
                {(entry.catalog.genres.length > 0 ? entry.catalog.genres : [getLocalizedListLabel(snapshot.lists, entry.activity.status, t)])
                  .slice(0, 3)
                  .map((token) => (
                    <span className="genre-chip" key={token}>{token}</span>
                  ))}
              </div>
              <p className="library-card-description">
                {isCatalogMetadataPending(entry.catalog) ? getEntryDisplayProgressText(entry, t) : getEntryDisplayProgressText(entry, t)}
              </p>
            </div>
          </article>
        )
      })}
    </section>
  )
}
