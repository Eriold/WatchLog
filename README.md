# WatchLog

WatchLog is a Manifest V3 browser extension for tracking what the user is watching or reading across streaming services and the web, without central tracking.

## Stack
- React + Vite + TypeScript
- PNPM
- Chrome Extension Manifest V3
- Local-first persistence on `chrome.storage.local`

## Surfaces
- `popup.html`: quick capture and save flow
- `library.html`: main library workspace
- `options.html`: import/export and roadmap settings
- `src/background/index.ts`: message router and repository host
- `src/content/index.ts`: in-page detection runner

## Commands
```bash
pnpm install
pnpm build
pnpm build chrome
pnpm build firefox
pnpm test
pnpm dev
pnpm deps:policy
```

## Dependency policy
- Direct dependencies are pinned to exact versions only; no `^` or `~`.
- `.npmrc` enforces `save-exact=true` and `minimumReleaseAge=1440` for PNPM.
- `preinstall` runs `scripts/enforce-dependency-policy.mjs` and blocks dependencies published less than 24 hours ago.
- Emergency bypass exists only through `WATCHLOG_SKIP_DEP_POLICY=1`.

## Load the extension
1. Run `pnpm build`.
2. Open the Chromium extension manager.
3. Enable developer mode.
4. Load the `dist/` folder as an unpacked extension.

For Firefox, run `pnpm build firefox` and load the generated `dist-firefox/` folder in Firefox's add-on debug workflow.

## Project notes
- Explorer currently runs on mock metadata behind a provider abstraction.
- Google Drive sync is intentionally deferred, but a provider stub already exists.
- `/prototype_ui` is reserved for the future visual source of truth.
- `/_agent` contains project memory and implementation notes.

## License
- This project is licensed under the [Apache License, Version 2.0](./LICENSE).
- If you reuse this code or a derivative, keep the original copyright notices and preserve attribution.
- If you distribute a derivative, retain the `NOTICE` file and any required attribution text.
- In plain terms: you can fork, modify, and even use it commercially, but you must keep the credit trail intact.
