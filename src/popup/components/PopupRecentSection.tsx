/** Renders the recent activity strip shown at the bottom of the popup using existing library snapshot data. */
import { getLocalizedListLabel } from '../../shared/i18n/helpers'
import { getTemporaryPoster } from '../../shared/mock-posters'
import type { LibraryEntry, WatchListDefinition } from '../../shared/types'
import type { PopupTranslate } from '../utils/popup-helpers'
import {
  getCatalogSyncState,
  getEntryProgressPercent,
  getPopupEntryProgressText,
  getTitleInitials,
} from '../utils/popup-helpers'
import { PlayIcon, SyncStatusGlyph } from './PopupIcons'

interface PopupRecentSectionProps {
  activeSessionsLabel: string
  entries: LibraryEntry[]
  lists: WatchListDefinition[]
  t: PopupTranslate
}

export function PopupRecentSection({
  activeSessionsLabel,
  entries,
  lists,
  t,
}: PopupRecentSectionProps) {
  return (
    <div className="popup-recent">
      <div className="section-heading">
        <div>
          <h2 className="section-title">{t('popup.continueWatching')}</h2>
          <p className="tiny">{t('popup.resumeLatest')}</p>
        </div>
        <span className="section-chip">{activeSessionsLabel}</span>
      </div>

      {entries.length === 0 ? (
        <div className="recent-empty-card">
          <strong>{t('popup.noRecentActivity')}</strong>
          <p className="tiny">{t('popup.noRecentActivityHint')}</p>
        </div>
      ) : (
        entries.map((entry) => {
          const syncState = getCatalogSyncState(entry.catalog)
          const showPendingPlaceholder = syncState === 'pending' && !entry.catalog.poster
          const progressPercent = getEntryProgressPercent(entry)

          return (
            <article className="recent-card" key={entry.catalog.id}>
              <div className="recent-art">
                {showPendingPlaceholder ? (
                  <div className="recent-art-image recent-art-placeholder" aria-hidden="true" />
                ) : (
                  <img
                    className="recent-art-image"
                    src={entry.catalog.poster ?? getTemporaryPoster(entry.catalog.normalizedTitle)}
                    alt={`${entry.catalog.title} poster`}
                  />
                )}
                {!entry.catalog.poster && !showPendingPlaceholder ? (
                  <span className="recent-art-fallback">{getTitleInitials(entry.catalog.title)}</span>
                ) : null}
                <span className="recent-art-overlay" />
                {syncState ? (
                  <span className={`catalog-sync-badge recent-sync-badge is-${syncState}`}>
                    <SyncStatusGlyph className="catalog-sync-icon" synced={syncState === 'synced'} />
                  </span>
                ) : null}
                <span className="recent-play-badge">
                  <PlayIcon />
                </span>
                {entry.activity.lastSource?.favicon ? (
                  <img
                    className="recent-source-badge"
                    src={entry.activity.lastSource.favicon}
                    alt={`${entry.activity.lastSource.siteName} favicon`}
                    onError={(event) => {
                      event.currentTarget.src = '/icons/favicon-16x16.png'
                    }}
                  />
                ) : null}
              </div>

              <div className="recent-body">
                <div>
                  <strong className="recent-title">{entry.catalog.title}</strong>
                  <p className="recent-subtitle">
                    {getPopupEntryProgressText(entry, t)} /{' '}
                    {getLocalizedListLabel(lists, entry.activity.status, t)}
                  </p>
                </div>

                <div className="recent-progress">
                  <div className="recent-progress-copy">
                    <span>
                      {progressPercent > 0
                        ? t('popup.completePercent', { percent: progressPercent })
                        : t('popup.recentlySaved')}
                    </span>
                    <span>{getLocalizedListLabel(lists, entry.activity.status, t)}</span>
                  </div>
                  <div className="recent-progress-track">
                    <div className="recent-progress-value" style={{ width: `${progressPercent}%` }} />
                  </div>
                </div>
              </div>
            </article>
          )
        })
      )}
    </div>
  )
}
