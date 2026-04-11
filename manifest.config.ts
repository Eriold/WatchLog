import { defineManifest } from '@crxjs/vite-plugin'

export type BuildTarget = 'chrome' | 'firefox'

const version = '0.1.0'

function createSharedManifest(target: BuildTarget) {
  const background =
    target === 'firefox'
      ? {
          scripts: ['src/background/index.ts'],
          type: 'module' as const,
        }
      : {
          service_worker: 'src/background/index.ts',
          type: 'module' as const,
        }

  return {
    manifest_version: 3,
    name: 'WatchLog',
    description:
      'Track what you are watching or reading across streaming sites and the web without central tracking.',
    version,
    icons: {
      16: 'icons/favicon-16x16.png',
      32: 'icons/favicon-32x32.png',
      48: 'icons/favicon-32x32.png',
      128: 'icons/android-chrome-192x192.png',
    },
    action: {
      default_title: 'WatchLog',
      default_popup: 'popup.html',
      default_icon: {
        16: 'icons/favicon-16x16.png',
        32: 'icons/favicon-32x32.png',
      },
    },
    background,
    options_page: 'options.html',
    permissions:
      target === 'firefox'
        ? ['storage', 'tabs', 'activeTab', 'scripting']
        : ['storage', 'tabs', 'activeTab', 'sidePanel', 'scripting'],
    host_permissions: ['<all_urls>'],
    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['src/content/index.ts'],
        run_at: 'document_idle',
      },
    ],
    ...(target === 'chrome'
      ? {
          side_panel: {
            default_path: 'library.html',
          },
        }
      : {
          sidebar_action: {
            default_panel: 'library.html',
            default_title: 'WatchLog',
          },
          browser_specific_settings: {
            gecko: {
              id: 'watchlog@eriold',
              data_collection_permissions: {
                required: ['none' as const],
              },
            },
          },
        }),
  }
}

export function createManifest(target: BuildTarget) {
  return defineManifest(createSharedManifest(target))
}
