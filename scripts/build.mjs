import { spawnSync } from 'node:child_process'

const target = (process.argv[2] ?? 'chrome').toLowerCase()

if (!['chrome', 'firefox'].includes(target)) {
  console.error(`Unknown build target: ${target}`)
  process.exit(1)
}

const typecheck = spawnSync('pnpm', ['exec', 'tsc', '-b'], {
  stdio: 'inherit',
  env: process.env,
})

if (typecheck.error) {
  throw typecheck.error
}

if ((typecheck.status ?? 1) !== 0) {
  process.exit(typecheck.status ?? 1)
}

const result = spawnSync('pnpm', ['exec', 'vite', 'build'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    WATCHLOG_BROWSER: target,
  },
})

if (result.error) {
  throw result.error
}

process.exit(result.status ?? 1)
