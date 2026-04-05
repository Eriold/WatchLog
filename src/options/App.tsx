import { useEffect, useState } from 'react'
import { exportActivity, exportCatalog, getLibrary, importBackup } from '../shared/client'
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
  const [snapshot, setSnapshot] = useState<WatchLogSnapshot>(getInitialSnapshot)
  const [catalogFile, setCatalogFile] = useState<File | null>(null)
  const [activityFile, setActivityFile] = useState<File | null>(null)
  const [message, setMessage] = useState('Loading options...')

  useEffect(() => {
    void getLibrary().then((response) => {
      setSnapshot(response.snapshot)
      setMessage('Local storage ready. Google Drive sync is planned for phase 2.')
    })
  }, [])

  async function handleExportCatalog(): Promise<void> {
    const response = await exportCatalog()
    downloadJson('catalog.json', response.payload)
    setMessage('catalog.json exported.')
  }

  async function handleExportActivity(): Promise<void> {
    const response = await exportActivity()
    downloadJson('activity.json', response.payload)
    setMessage('activity.json exported.')
  }

  async function handleImport(): Promise<void> {
    if (!catalogFile || !activityFile) {
      setMessage('Select both catalog.json and activity.json first.')
      return
    }

    const catalog = JSON.parse(await catalogFile.text()) as ExportCatalogPayload
    const activity = JSON.parse(await activityFile.text()) as ExportActivityPayload
    const response = await importBackup(catalog, activity)
    setSnapshot(response.snapshot)
    setMessage('Backup imported into local storage.')
  }

  return (
    <div className="app-shell options-shell">
      <div className="panel options-panel">
        <div className="brand-lockup">
          <img className="brand-icon" src="/icons/favicon-32x32.png" alt="WatchLog logo" />
          <p className="tiny">WatchLog settings</p>
        </div>
        <h1 className="section-title">Local storage and project scaffolding</h1>
        <p className="muted">{message}</p>

        <div className="options-grid">
          <section className="options-card stack">
            <h2 className="section-title">Storage snapshot</h2>
            <span className="chip">{snapshot.catalog.length} catalog items</span>
            <span className="chip">{snapshot.activity.length} user records</span>
            <span className="chip">{snapshot.lists.length} lists configured</span>
            <div className="row">
              <button className="button" type="button" onClick={handleExportCatalog}>
                Export catalog.json
              </button>
              <button className="button secondary" type="button" onClick={handleExportActivity}>
                Export activity.json
              </button>
            </div>
          </section>

          <section className="options-card stack">
            <h2 className="section-title">Import backup</h2>
            <div>
              <label className="label" htmlFor="catalog-file">
                catalog.json
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
                activity.json
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
              Import backup
            </button>
          </section>

          <section className="options-card stack">
            <h2 className="section-title">Roadmap hooks</h2>
            <p className="muted">
              Google authentication and Drive `appDataFolder` sync are intentionally deferred. The
              current storage contracts already isolate `catalog.json` and `activity.json`.
            </p>
            <p className="tiny">
              A future `DriveStorageProvider` can replace the local provider without changing the UI
              contracts.
            </p>
          </section>

          <section className="options-card stack">
            <h2 className="section-title">Design pipeline</h2>
            <p className="muted">
              `/prototype_ui` has been scaffolded as the visual intake folder. Drop future mockups
              there and wire them into popup, side panel or options surfaces.
            </p>
            <p className="tiny">
              The current UI is intentionally structured, not final. It exists to validate flows and
              data contracts.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
