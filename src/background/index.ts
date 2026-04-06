import { MockMetadataProvider } from '../shared/metadata/mock-provider'
import type {
  ActiveDetectionResponse,
  AddListResponse,
  DetectionDebugInfo,
  ExplorerResponse,
  ExportActivityResponse,
  ExportCatalogResponse,
  LibraryResponse,
  SaveDetectionResponse,
  UpdateEntryResponse,
  WatchLogMessage,
} from '../shared/messages'
import { STORAGE_KEYS } from '../shared/constants'
import {
  cleanTitle,
  getFavicon,
  inferMediaType,
  isPlaceholderTitle,
  parseProgress,
  resolveDetectedTitle,
} from '../shared/detection/helpers'
import { LocalStorageProvider } from '../shared/storage/local-storage-provider'
import { storageGet, storageSet, getActiveTab } from '../shared/storage/browser'
import { WatchLogRepository } from '../shared/storage/repository'
import type { DetectionResult } from '../shared/types'
import { normalizeTitle } from '../shared/utils/normalize'

const metadataProvider = new MockMetadataProvider()
const repository = new WatchLogRepository(
  new LocalStorageProvider(),
  metadataProvider,
)

async function getDetectionMap(): Promise<Record<string, DetectionResult>> {
  return storageGet<Record<string, DetectionResult>>(
    chrome.storage.session,
    STORAGE_KEYS.detectionByTab,
    {},
  )
}

async function setDetection(tabId: number, detection: DetectionResult): Promise<void> {
  const map = await getDetectionMap()
  map[String(tabId)] = detection
  await storageSet(chrome.storage.session, STORAGE_KEYS.detectionByTab, map)
}

async function removeDetection(tabId: number): Promise<void> {
  const map = await getDetectionMap()
  delete map[String(tabId)]
  await storageSet(chrome.storage.session, STORAGE_KEYS.detectionByTab, map)
}

async function getResolvedTab(tabId?: number): Promise<chrome.tabs.Tab | null> {
  if (tabId === undefined) {
    return getActiveTab()
  }

  try {
    return await chrome.tabs.get(tabId)
  } catch {
    return null
  }
}

interface InjectedPageSnapshot {
  href: string
  pageTitle: string
  bodyText: string
  firstH1: string | null
  playerResponseTitle: string | null
  ogTitle: string | null
  metaTitle: string | null
  itempropName: string | null
  youtubeHeading: string | null
}

interface DetectionProbeResult {
  detection: DetectionResult | null
  source: DetectionDebugInfo['source']
  reason?: string
}

function inferSourceSite(url: URL): string {
  const hostname = url.hostname

  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
    return 'YouTube'
  }

  if (hostname.includes('netflix.com')) {
    return 'Netflix'
  }

  if (hostname.includes('max.com')) {
    return 'Max'
  }

  if (hostname.includes('primevideo.com') || hostname.includes('amazon.com')) {
    return 'Prime Video'
  }

  return hostname.replace(/^www\./i, '')
}

function buildDetectionFromSnapshot(snapshot: InjectedPageSnapshot): DetectionResult | null {
  const url = new URL(snapshot.href)
  const sourceSite = inferSourceSite(url)
  const rawTitle = resolveDetectedTitle(sourceSite, [
    snapshot.firstH1,
    snapshot.playerResponseTitle,
    snapshot.youtubeHeading,
    snapshot.ogTitle,
    snapshot.metaTitle,
    snapshot.itempropName,
    snapshot.pageTitle,
  ])

  if (!rawTitle) {
    return null
  }

  const title = cleanTitle(rawTitle, sourceSite)
  if (!title || isPlaceholderTitle(title, sourceSite)) {
    return null
  }

  const parsed = parseProgress(`${rawTitle} ${snapshot.pageTitle} ${snapshot.bodyText}`)

  return {
    title,
    normalizedTitle: normalizeTitle(title),
    mediaType: inferMediaType(url, parsed, title),
    sourceSite,
    url: url.toString(),
    favicon: getFavicon(url),
    pageTitle: snapshot.pageTitle,
    season: parsed.season,
    episode: parsed.episode,
    episodeTotal: parsed.episodeTotal,
    chapter: parsed.chapter,
    chapterTotal: parsed.chapterTotal,
    progressLabel: parsed.progressLabel,
    confidence: 0.75,
  }
}

async function requestScriptedDetection(tabId: number): Promise<DetectionProbeResult> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const playerResponseTitle =
          (window as typeof window & {
            ytInitialPlayerResponse?: {
              videoDetails?: {
                title?: string
              }
            }
          }).ytInitialPlayerResponse?.videoDetails?.title ?? null
        const compact = (value: string) => value.replace(/\s+/g, ' ').trim()
        const getMeta = (property: string) =>
          document
            .querySelector(`meta[property="${property}"], meta[name="${property}"]`)
            ?.getAttribute('content')
            ?.trim() ?? null
        const getText = (selector: string) => {
          const text = document.querySelector(selector)?.textContent?.trim()
          return text ? compact(text) : null
        }

        let firstH1: string | null = null
        for (const heading of document.querySelectorAll('h1')) {
          const text = heading.textContent?.trim()
          if (text) {
            firstH1 = compact(text)
            break
          }
        }

        return {
          href: window.location.href,
          pageTitle: document.title,
          bodyText: compact(document.body?.innerText ?? '').slice(0, 8000),
          firstH1,
          playerResponseTitle: playerResponseTitle ? compact(playerResponseTitle) : null,
          ogTitle: getMeta('og:title'),
          metaTitle: getMeta('title'),
          itempropName:
            document.querySelector('meta[itemprop="name"]')?.getAttribute('content')?.trim() ??
            null,
          youtubeHeading:
            getText('ytd-watch-metadata h1') ??
            getText('#title h1') ??
            getText('h1.ytd-watch-metadata') ??
            getText('yt-formatted-string.style-scope.ytd-watch-metadata'),
        }
      },
    })

    const detection = result?.result
      ? buildDetectionFromSnapshot(result.result as InjectedPageSnapshot)
      : null

    return {
      detection,
      source: detection ? 'scripting' : 'none',
      reason: detection ? undefined : 'scripted-fallback-returned-null',
    }
  } catch {
    return {
      detection: null,
      source: 'none',
      reason: 'scripted-fallback-failed',
    }
  }
}

async function requestLiveDetection(tabId: number): Promise<DetectionProbeResult> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'watchlog/request-live-detection',
    })

    const detection =
      (response as { detection?: DetectionResult | null } | undefined)?.detection ?? null

    if (detection) {
      return {
        detection,
        source: 'content-script',
      }
    }

    const scriptedResult = await requestScriptedDetection(tabId)
    return scriptedResult.detection
      ? scriptedResult
      : {
          ...scriptedResult,
          reason: 'content-script-returned-null',
        }
  } catch {
    return requestScriptedDetection(tabId)
  }
}

function isUsableDetection(detection: DetectionResult | null): detection is DetectionResult {
  if (!detection) {
    return false
  }

  return !isPlaceholderTitle(detection.title, detection.sourceSite)
}

async function resolveActiveDetection(
  forceRefresh = false,
  targetTabId?: number,
): Promise<ActiveDetectionResponse> {
  const tab = await getResolvedTab(targetTabId)
  const map = await getDetectionMap()
  let detection = tab?.id !== undefined ? map[String(tab.id)] ?? null : null
  let debug: DetectionDebugInfo = {
    tabId: tab?.id ?? null,
    tabUrl: tab?.url ?? tab?.pendingUrl ?? null,
    source: 'none',
    reason: tab ? undefined : targetTabId !== undefined ? 'target-tab-not-found' : 'no-active-tab',
  }

  if (!forceRefresh && isUsableDetection(detection)) {
    return {
      detection,
      debug: {
        ...debug,
        source: 'cache',
      },
    }
  }

  if (tab?.id !== undefined) {
    const probe = await requestLiveDetection(tab.id)
    detection = probe.detection
    debug = {
      ...debug,
      source: probe.source,
      reason: probe.reason,
    }

    if (detection) {
      await setDetection(tab.id, detection)
    } else {
      await removeDetection(tab.id)
    }
  }

  return {
    detection: isUsableDetection(detection) ? detection : null,
    debug,
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void repository.getSnapshot()
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
})

chrome.runtime.onStartup.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
})

chrome.tabs.onRemoved.addListener((tabId) => {
  void removeDetection(tabId)
})

chrome.runtime.onMessage.addListener((message: WatchLogMessage, sender, sendResponse) => {
  const respond = async () => {
    switch (message.type) {
      case 'watchlog/report-detection': {
        if (sender.tab?.id !== undefined) {
          await setDetection(sender.tab.id, message.payload)
        }
        sendResponse({ ok: true })
        return
      }
      case 'watchlog/get-active-detection': {
        sendResponse(await resolveActiveDetection(false, message.payload?.tabId))
        return
      }
      case 'watchlog/reanalyze-active-detection': {
        sendResponse(await resolveActiveDetection(true, message.payload?.tabId))
        return
      }
      case 'watchlog/save-detection': {
        const response: SaveDetectionResponse = await repository.saveDetection(message.payload)
        sendResponse(response)
        return
      }
      case 'watchlog/add-from-explorer': {
        const item = await metadataProvider.getById(message.payload.metadataId)
        if (!item) {
          throw new Error('Explorer item not found.')
        }

        const response: SaveDetectionResponse = await repository.addFromMetadata(
          item,
          message.payload.listId,
        )
        sendResponse(response)
        return
      }
      case 'watchlog/get-library': {
        console.log('[WatchLog] background:get-library:start')
        const response: LibraryResponse = {
          snapshot: await repository.getSnapshot(),
        }
        console.log('[WatchLog] background:get-library:response', response)
        sendResponse(response)
        return
      }
      case 'watchlog/get-explorer': {
        const response: ExplorerResponse = {
          items: await repository.getExplorer(message.payload?.query),
        }
        sendResponse(response)
        return
      }
      case 'watchlog/update-entry': {
        const response: UpdateEntryResponse = await repository.updateEntry(message.payload)
        sendResponse(response)
        return
      }
      case 'watchlog/add-list': {
        console.log('[WatchLog] background:add-list:start', {
          label: message.payload.label,
        })
        const response: AddListResponse = await repository.addList(message.payload.label)
        console.log('[WatchLog] background:add-list:response', response)
        sendResponse(response)
        return
      }
      case 'watchlog/export-catalog': {
        const response: ExportCatalogResponse = {
          payload: await repository.exportCatalog(),
        }
        sendResponse(response)
        return
      }
      case 'watchlog/export-activity': {
        const response: ExportActivityResponse = {
          payload: await repository.exportActivity(),
        }
        sendResponse(response)
        return
      }
      case 'watchlog/import-backup': {
        const snapshot = await repository.importBackup(
          message.payload.catalog,
          message.payload.activity,
        )
        const response: LibraryResponse = { snapshot }
        sendResponse(response)
        return
      }
      default:
        sendResponse({ error: 'Unsupported message.' })
    }
  }

  void respond().catch((error: unknown) => {
    console.error('[WatchLog] background:onMessage:error', {
      type: message.type,
      error,
    })
    sendResponse({
      error: error instanceof Error ? error.message : 'Unexpected runtime error.',
    })
  })

  return true
})
