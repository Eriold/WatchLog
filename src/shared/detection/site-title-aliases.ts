import { STORAGE_KEYS } from '../constants'
import { storageGet, storageSet } from '../storage/browser'
import { compactText, normalizeTitle } from '../utils/normalize'
import { nowIso } from '../utils/time'

export interface SiteTitleAliasRecord {
  siteKey: string
  canonicalTitle: string
  normalizedTitle: string
  aliases: string[]
  updatedAt: string
}

type SiteTitleAliasStore = SiteTitleAliasRecord[]

function normalizeSiteKey(siteKey: string): string {
  return compactText(siteKey).toLowerCase().replace(/^www\./i, '')
}

function canUseChromeStorage(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.storage !== 'undefined' &&
    typeof chrome.storage.local !== 'undefined'
  )
}

function uniqueDisplayTitles(values: string[]): string[] {
  const seen = new Set<string>()
  const titles: string[] = []

  for (const value of values) {
    const trimmed = value.trim()
    const normalized = normalizeTitle(trimmed)
    if (!trimmed || !normalized || seen.has(normalized)) {
      continue
    }

    seen.add(normalized)
    titles.push(trimmed)
  }

  return titles
}

async function readStore(): Promise<SiteTitleAliasStore> {
  if (!canUseChromeStorage()) {
    return []
  }

  return storageGet<SiteTitleAliasStore>(chrome.storage.local, STORAGE_KEYS.siteTitleAliases, [])
}

async function writeStore(store: SiteTitleAliasStore): Promise<void> {
  if (!canUseChromeStorage()) {
    return
  }

  await storageSet(chrome.storage.local, STORAGE_KEYS.siteTitleAliases, store)
}

export async function getSiteTitleAliasCandidates(
  siteKey: string,
  canonicalTitle?: string,
): Promise<string[]> {
  const normalizedSiteKey = normalizeSiteKey(siteKey)
  const normalizedCanonical = canonicalTitle ? normalizeTitle(canonicalTitle) : ''
  const store = await readStore()

  const records = store
    .filter((item) => item.siteKey === normalizedSiteKey)
    .sort((left, right) => {
      const leftFocus =
        normalizedCanonical &&
        (left.normalizedTitle === normalizedCanonical ||
          left.aliases.some((alias) => normalizeTitle(alias) === normalizedCanonical))
          ? 1
          : 0
      const rightFocus =
        normalizedCanonical &&
        (right.normalizedTitle === normalizedCanonical ||
          right.aliases.some((alias) => normalizeTitle(alias) === normalizedCanonical))
          ? 1
          : 0

      if (rightFocus !== leftFocus) {
        return rightFocus - leftFocus
      }

      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    })

  if (records.length === 0) {
    return []
  }

  return uniqueDisplayTitles(records.flatMap((record) => [record.canonicalTitle, ...record.aliases]))
}

export async function rememberSiteTitleAliases(input: {
  siteKey: string
  canonicalTitle: string
  aliases?: string[]
}): Promise<void> {
  const normalizedSiteKey = normalizeSiteKey(input.siteKey)
  const normalizedTitle = normalizeTitle(input.canonicalTitle)
  if (!normalizedSiteKey || !normalizedTitle) {
    return
  }

  const store = await readStore()
  const nextAliases = uniqueDisplayTitles([
    input.canonicalTitle,
    ...(input.aliases ?? []),
  ]).filter((value) => normalizeTitle(value) !== normalizedTitle)

  const existingIndex = store.findIndex(
    (item) => item.siteKey === normalizedSiteKey && item.normalizedTitle === normalizedTitle,
  )

  const nextRecord: SiteTitleAliasRecord = {
    siteKey: normalizedSiteKey,
    canonicalTitle: input.canonicalTitle.trim(),
    normalizedTitle,
    aliases: nextAliases,
    updatedAt: nowIso(),
  }

  if (existingIndex >= 0) {
    const existing = store[existingIndex]
    const mergedAliases = uniqueDisplayTitles([
      existing.canonicalTitle,
      ...existing.aliases,
      nextRecord.canonicalTitle,
      ...nextRecord.aliases,
    ]).filter((value) => normalizeTitle(value) !== normalizedTitle)

    store[existingIndex] = {
      ...existing,
      canonicalTitle: nextRecord.canonicalTitle || existing.canonicalTitle,
      aliases: mergedAliases,
      updatedAt: nextRecord.updatedAt,
    }
  } else {
    store.push(nextRecord)
  }

  await writeStore(store)
}
