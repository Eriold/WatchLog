export const enOptionsTranslations = {
  'options.loading': 'Loading options...',
  'options.ready': 'Local storage ready. Google Drive sync is planned for phase 2.',
  'options.title': 'Local storage and project scaffolding',
  'options.storageSnapshot': 'Storage snapshot',
  'options.catalogItems.one': '{count} catalog item',
  'options.catalogItems.other': '{count} catalog items',
  'options.userRecords.one': '{count} user record',
  'options.userRecords.other': '{count} user records',
  'options.listsConfigured.one': '{count} list configured',
  'options.listsConfigured.other': '{count} lists configured',
  'options.exportCatalog': 'Export catalog.json',
  'options.exportActivity': 'Export activity.json',
  'options.catalogExported': 'catalog.json exported.',
  'options.activityExported': 'activity.json exported.',
  'options.importBackup': 'Import backup',
  'options.catalogJson': 'catalog.json',
  'options.activityJson': 'activity.json',
  'options.importAction': 'Import backup',
  'options.selectBothFirst': 'Select both catalog.json and activity.json first.',
  'options.imported': 'Backup imported into local storage.',
  'options.roadmapHooks': 'Roadmap hooks',
  'options.roadmapBody':
    'Google authentication and Drive appDataFolder sync are intentionally deferred. The current storage contracts already isolate catalog.json and activity.json.',
  'options.roadmapHint':
    'A future DriveStorageProvider can replace the local provider without changing the UI contracts.',
  'options.designPipeline': 'Design pipeline',
  'options.designBody':
    '/prototype_ui has been scaffolded as the visual intake folder. Drop future mockups there and wire them into popup, library or settings surfaces.',
  'options.designHint':
    'The current UI is intentionally structured, not final. It exists to validate flows and data contracts.',
} as const
