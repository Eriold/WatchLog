import { createWriteStream, existsSync, mkdirSync, rmSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import archiver from 'archiver'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const releaseDir = path.join(rootDir, 'release')
const packageJson = await import('../package.json', { with: { type: 'json' } })
const version = packageJson.default.version

const targets = [
  {
    name: 'chrome',
    distDir: path.join(rootDir, 'dist'),
    outputFile: path.join(releaseDir, 'watchlog-chrome.zip'),
  },
  {
    name: 'firefox',
    distDir: path.join(rootDir, 'dist-firefox'),
    outputFile: path.join(releaseDir, 'watchlog-firefox.zip'),
  },
]

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    env,
  })

  if (result.error) {
    throw result.error
  }

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1)
  }
}

async function getDirectorySize(directoryPath) {
  const entries = await readdir(directoryPath, { withFileTypes: true })
  const sizes = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directoryPath, entry.name)
      if (entry.isDirectory()) {
        return getDirectorySize(fullPath)
      }

      const entryStat = await stat(fullPath)
      return entryStat.size
    }),
  )

  return sizes.reduce((sum, size) => sum + size, 0)
}

function zipDirectory(sourceDir, outputFile) {
  return new Promise((resolvePromise, rejectPromise) => {
    const output = createWriteStream(outputFile)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', resolvePromise)
    output.on('error', rejectPromise)
    archive.on('error', rejectPromise)

    archive.pipe(output)
    archive.directory(sourceDir, false)
    archive.finalize()
  })
}

rmSync(releaseDir, { recursive: true, force: true })
mkdirSync(releaseDir, { recursive: true })

for (const target of targets) {
  run('pnpm', ['run', `build:${target.name}`], {
    ...process.env,
    WATCHLOG_RELEASE_VERSION: version,
  })

  if (!existsSync(target.distDir)) {
    throw new Error(`Missing build output for ${target.name}: ${target.distDir}`)
  }

  await zipDirectory(target.distDir, target.outputFile)
}

const releaseSummary = await Promise.all(
  targets.map(async (target) => {
    const sourceSize = await getDirectorySize(target.distDir)
    const archiveSize = (await stat(target.outputFile)).size
    return {
      target: target.name,
      sourceSize,
      archiveSize,
      fileName: path.basename(target.outputFile),
    }
  }),
)

console.log(`Release artifacts ready for WatchLog v${version}`)
for (const item of releaseSummary) {
  console.log(`- ${item.target}: ${item.fileName} (${item.archiveSize} bytes, source ${item.sourceSize} bytes)`)
}
