import { defineManifest } from '@crxjs/vite-plugin'

const version = '0.1.0'

export default defineManifest({
  manifest_version: 3,
  name: 'WatchLog',
  description:
    'Track what you are watching or reading across streaming sites and the web without central tracking.',
  version,
  action: {
    default_title: 'WatchLog',
    default_popup: 'popup.html',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  options_page: 'options.html',
  side_panel: {
    default_path: 'sidepanel.html',
  },
  permissions: ['storage', 'tabs', 'activeTab', 'sidePanel'],
  host_permissions: ['<all_urls>'],
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
})
