import { spawnSync } from 'node:child_process'

export async function prepare(_pluginConfig, context) {
  const result = spawnSync('pnpm', ['run', 'build:release'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      WATCHLOG_RELEASE_VERSION: context.nextRelease.version,
    },
  })

  if (result.error) {
    throw result.error
  }

  if ((result.status ?? 1) !== 0) {
    throw new Error(`Release artifact build failed with status ${result.status ?? 1}`)
  }
}
