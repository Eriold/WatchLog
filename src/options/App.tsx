import { useEffect, useState } from 'react'
import { exportActivity, exportCatalog, getLibrary, importBackup } from '../shared/client'
import { useI18n } from '../shared/i18n/useI18n'
import { LanguageSelect } from '../shared/ui/LanguageSelect'
import { downloadJson } from '../shared/utils/download'
import type {
  ExportActivityPayload,
  ExportCatalogPayload,
  WatchLogSnapshot,
} from '../shared/types'
import './options.css'

function getInitialSnapshot(): WatchLogSnapshot {
  return {
    catalog: [],
    activity: [],
    lists: [],
  }
}

export function OptionsApp() {
  const { t } = useI18n()
  const [snapshot, setSnapshot] = useState<WatchLogSnapshot>(getInitialSnapshot)
  const [catalogFile, setCatalogFile] = useState<File | null>(null)
  const [activityFile, setActivityFile] = useState<File | null>(null)
  const [messageState, setMessageState] = useState<
    | 'options.loading'
    | 'options.ready'
    | 'options.catalogExported'
    | 'options.activityExported'
    | 'options.selectBothFirst'
    | 'options.imported'
  >('options.loading')

  useEffect(() => {
    document.title = t('titles.options')
  }, [t])

  useEffect(() => {
    void getLibrary().then((response) => {
      setSnapshot(response.snapshot)
      setMessageState('options.ready')
    })
  }, [])

  async function handleExportCatalog(): Promise<void> {
    const response = await exportCatalog()
    downloadJson('catalog.json', response.payload)
    setMessageState('options.catalogExported')
  }

  async function handleExportActivity(): Promise<void> {
    const response = await exportActivity()
    downloadJson('activity.json', response.payload)
    setMessageState('options.activityExported')
  }

  async function handleImport(): Promise<void> {
    if (!catalogFile || !activityFile) {
      setMessageState('options.selectBothFirst')
      return
    }

    const catalog = JSON.parse(await catalogFile.text()) as ExportCatalogPayload
    const activity = JSON.parse(await activityFile.text()) as ExportActivityPayload
    const response = await importBackup(catalog, activity)
    setSnapshot(response.snapshot)
    setMessageState('options.imported')
  }

  const message = t(messageState)

  return (
    <div className="app-shell options-shell">
      <div className="panel options-panel">
        <div className="options-topbar">
          <div className="brand-lockup">
            <img className="brand-icon" src="/icons/favicon-32x32.png" alt="WatchLog logo" />
            <p className="tiny">{`${t('common.appName')} · ${t('common.settings')}`}</p>
          </div>
          <LanguageSelect className="options-language-select" compact />
        </div>
        <h1 className="section-title">{t('options.title')}</h1>
        <p className="muted">{message}</p>

        <div className="options-grid">
          <section className="options-card stack">
            <h2 className="section-title">{t('options.storageSnapshot')}</h2>
            <span className="chip">
              {t(
                snapshot.catalog.length === 1 ? 'options.catalogItems.one' : 'options.catalogItems.other',
                { count: snapshot.catalog.length },
              )}
            </span>
            <span className="chip">
              {t(
                snapshot.activity.length === 1 ? 'options.userRecords.one' : 'options.userRecords.other',
                { count: snapshot.activity.length },
              )}
            </span>
            <span className="chip">
              {t(
                snapshot.lists.length === 1 ? 'options.listsConfigured.one' : 'options.listsConfigured.other',
                { count: snapshot.lists.length },
              )}
            </span>
            <div className="row">
              <button className="button" type="button" onClick={handleExportCatalog}>
                {t('options.exportCatalog')}
              </button>
              <button className="button secondary" type="button" onClick={handleExportActivity}>
                {t('options.exportActivity')}
              </button>
            </div>
          </section>

          <section className="options-card stack">
            <h2 className="section-title">{t('options.importBackup')}</h2>
            <div>
              <label className="label" htmlFor="catalog-file">
                {t('options.catalogJson')}
              </label>
              <input
                id="catalog-file"
                className="field"
                type="file"
                accept="application/json"
                onChange={(event) => setCatalogFile(event.target.files?.[0] ?? null)}
              />
            </div>
            <div>
              <label className="label" htmlFor="activity-file">
                {t('options.activityJson')}
              </label>
              <input
                id="activity-file"
                className="field"
                type="file"
                accept="application/json"
                onChange={(event) => setActivityFile(event.target.files?.[0] ?? null)}
              />
            </div>
            <button className="button" type="button" onClick={handleImport}>
              {t('options.importAction')}
            </button>
          </section>

          <section className="options-card stack">
            <h2 className="section-title">{t('options.roadmapHooks')}</h2>
            <p className="muted">{t('options.roadmapBody')}</p>
            <p className="tiny">{t('options.roadmapHint')}</p>
          </section>

          <section className="options-card stack">
            <h2 className="section-title">{t('options.designPipeline')}</h2>
            <p className="muted">{t('options.designBody')}</p>
            <p className="tiny">{t('options.designHint')}</p>
          </section>
        </div>
      </div>
    </div>
  )
}
