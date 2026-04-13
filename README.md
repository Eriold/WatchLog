# WatchLog

WatchLog is a browser extension for tracking what you are watching or reading across streaming sites and web pages without depending on a central account or remote tracking service.

It is built as a Manifest V3 extension and currently targets:
- Google Chrome / Chromium-based browsers
- Mozilla Firefox

## What It Does

WatchLog helps you:
- detect the title currently open in the active tab when the site is supported
- save that item to your local library
- organize items into lists such as `Library`, `Watching`, and `Completed`
- mark favorites
- review and manage your saved library from the full library page
- import certain source catalogs into the local library

## Important For Regular Users

- Your data is stored locally in the browser through `chrome.storage.local` / extension storage.
- There is currently no mandatory account, login, or cloud sync flow for normal usage.
- If you remove the extension or clear extension storage, your local data can be lost.
- The safest habit is to periodically use the import/export tools from the extension settings/options page if you care about backups.
- Firefox temporary installs are not permanent. If you load the extension through Firefox's temporary add-on workflow, you usually need to load it again after restarting Firefox.

## Current Status

This is an active project, not a store-published end-user package yet.

That means:
- installation is currently manual
- some sites work better than others
- Chrome and Firefox builds are both supported, but the loading workflow is different

## Tech Stack

- React
- Vite
- TypeScript
- PNPM
- Browser Extension Manifest V3

## Project Surfaces

- `popup.html`: quick capture flow
- `library.html`: full library workspace
- `options.html`: import/export and settings
- `src/background/index.ts`: background runtime host
- `src/content/index.ts`: page detection runner

## Requirements

Before building the extension locally, make sure you have:

- Node.js installed
- PNPM installed

Example:

```bash
node --version
pnpm --version
```

## Install Dependencies

```bash
pnpm install
```

## Available Commands

```bash
pnpm dev
pnpm build
pnpm build:chrome
pnpm build:firefox
pnpm test
pnpm lint
pnpm deps:policy
```

Notes:
- `pnpm build` defaults to the Chrome build target.
- `pnpm build:chrome` explicitly builds for Chrome/Chromium.
- `pnpm build:firefox` builds the Firefox-compatible output.

## Build Outputs

After building, the generated folders are:

- Chrome/Chromium: `dist/`
- Firefox: `dist-firefox/`

## How To Run In Chrome Or Chromium

### 1. Build the Chrome version

```bash
pnpm build:chrome
```

You can also use:

```bash
pnpm build
```

### 2. Open the extensions page

In Chrome, Brave, Edge, or another Chromium browser, open:

- `chrome://extensions`

### 3. Enable Developer Mode

Turn on the `Developer mode` switch.

### 4. Load the extension

Click `Load unpacked` and select the `dist/` folder.

### 5. Start using it

Once loaded:
- pin the extension if you want quick access
- open a supported page
- click the WatchLog icon
- save the detected item from the popup
- open the full library when you want to manage your catalog

## How To Run In Firefox

### 1. Build the Firefox version

```bash
pnpm build:firefox
```

### 2. Open Firefox debugging

Open:

- `about:debugging#/runtime/this-firefox`

### 3. Load the temporary add-on

Click `Load Temporary Add-on...` and select:

- `dist-firefox/manifest.json`

### 4. Important Firefox note

This temporary installation usually does not survive a full browser restart.

That means:
- if Firefox restarts, you may need to load the add-on again
- rebuilding the extension may require reloading it in Firefox

## Chrome vs Firefox Behavior

WatchLog supports both browsers, but there are a few practical differences:

- Chrome build uses the MV3 service worker path for the background script.
- Firefox build uses the Firefox-compatible background script form.
- Chrome includes the `sidePanel` permission.
- Firefox uses `sidebar_action` instead of Chrome's side panel configuration.
- Temporary extension loading is more straightforward and persistent in Chromium during development.
- Firefox temporary loading is more limited for day-to-day non-technical use.

## Recommended Flow For Non-Technical Users

If you just want to try the extension with the least friction:

1. Use Chrome or another Chromium browser first.
2. Run `pnpm build:chrome`.
3. Load the `dist/` folder through `chrome://extensions`.
4. Test the popup on supported pages.
5. Use the library and options pages to verify your data is being stored correctly.

## Typical Usage

1. Open a supported media page.
2. Click the WatchLog extension icon.
3. Review the detected title, list, favorite state, and progress.
4. Save it to your local library.
5. Open the full library to edit, organize, or review entries.

## Data And Backup Notes

- WatchLog is local-first.
- Data is not automatically synced to a remote server in the current flow.
- If you switch browsers, local data does not automatically move with you.
- If you reinstall the browser profile or remove extension data, your library may disappear unless you exported it first.

## Dependency Policy

This project intentionally applies a conservative dependency policy:

- direct dependencies are pinned to exact versions
- `.npmrc` enforces `save-exact=true`
- `.npmrc` also enforces a minimum package release age
- `preinstall` runs `scripts/enforce-dependency-policy.mjs`

Emergency bypass exists only through:

```bash
WATCHLOG_SKIP_DEP_POLICY=1
```

## Troubleshooting

### The extension does not appear in the browser

- Make sure you loaded the correct folder:
  - Chrome: `dist/`
  - Firefox: `dist-firefox/manifest.json`
- Rebuild after code changes.
- Reload the extension from the browser's extension page.

### The popup says it cannot detect the current page

- The current site may not be fully supported yet.
- Try refreshing the tab and reopening the popup.
- Try the popup's reanalyze action if available.

### Firefox lost the extension after restart

That is expected when using Firefox's temporary add-on workflow during development.

### My saved data is gone

- Check whether the extension storage was cleared.
- Check whether you are using the same browser profile.
- Restore from an exported backup if you created one earlier.

## Project Notes

- AniList is currently the main live metadata source for supported anime/manga flows.
- Google Drive sync is intentionally deferred.
- `prototype_ui/` is the visual reference area for product direction.
- `/_agent/` contains project memory and implementation notes used during development.

## License

This project is licensed under the [Apache License, Version 2.0](./LICENSE).

If you reuse or distribute it:
- keep the original copyright notices
- retain the `NOTICE` file where required
- preserve attribution
