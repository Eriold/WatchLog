import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const MINIMUM_AGE_MINUTES = Number.parseInt(
  process.env.WATCHLOG_MIN_DEP_AGE_MINUTES ?? '1440',
  10,
)
const REGISTRY_URL = process.env.WATCHLOG_NPM_REGISTRY ?? 'https://registry.npmjs.org'

function encodePackageName(name) {
  return name
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

function isExactVersion(specifier) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(specifier)
}

async function loadPackageJson() {
  const packageJsonPath = path.join(process.cwd(), 'package.json')
  const raw = await readFile(packageJsonPath, 'utf8')
  return JSON.parse(raw)
}

async function getPublishedAt(name, version) {
  const response = await fetch(`${REGISTRY_URL}/${encodePackageName(name)}`, {
    headers: {
      accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Could not query ${name}@${version} from npm registry (${response.status}).`)
  }

  const metadata = await response.json()
  return metadata.time?.[version] ?? null
}

async function main() {
  if (process.env.WATCHLOG_SKIP_DEP_POLICY === '1') {
    console.log('Dependency policy skipped via WATCHLOG_SKIP_DEP_POLICY=1')
    return
  }

  const packageJson = await loadPackageJson()
  const directDependencies = [
    ...Object.entries(packageJson.dependencies ?? {}).map(([name, specifier]) => ({
      name,
      specifier,
      group: 'dependencies',
    })),
    ...Object.entries(packageJson.devDependencies ?? {}).map(([name, specifier]) => ({
      name,
      specifier,
      group: 'devDependencies',
    })),
  ]

  const invalidSpecifiers = directDependencies.filter(({ specifier }) => !isExactVersion(specifier))
  if (invalidSpecifiers.length > 0) {
    const details = invalidSpecifiers
      .map(({ name, specifier, group }) => `- ${group}: ${name} -> ${specifier}`)
      .join('\n')

    throw new Error(
      `All direct dependencies must use exact versions.\n${details}\n` +
        'Use pnpm with save-exact enabled or pin the versions manually.',
    )
  }

  const now = Date.now()
  const tooRecent = []

  for (const dependency of directDependencies) {
    const publishedAt = await getPublishedAt(dependency.name, dependency.specifier)
    if (!publishedAt) {
      throw new Error(`No publish timestamp found for ${dependency.name}@${dependency.specifier}.`)
    }

    const ageMinutes = Math.floor((now - Date.parse(publishedAt)) / 60000)
    if (ageMinutes < MINIMUM_AGE_MINUTES) {
      tooRecent.push({
        ...dependency,
        publishedAt,
        ageMinutes,
      })
    }
  }

  if (tooRecent.length > 0) {
    const details = tooRecent
      .map(({ name, specifier, publishedAt, ageMinutes, group }) => {
        return `- ${group}: ${name}@${specifier} published ${publishedAt} (${ageMinutes} minutes old)`
      })
      .join('\n')

    throw new Error(
      `Direct dependencies must be at least ${MINIMUM_AGE_MINUTES} minutes old.\n${details}`,
    )
  }

  console.log(
    `Dependency policy passed for ${directDependencies.length} direct dependencies. Minimum age: ${MINIMUM_AGE_MINUTES} minutes.`,
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
