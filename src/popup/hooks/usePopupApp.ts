/** Centralizes popup state, side effects, derived values and handlers so the popup root stays thin and stable. */
import { useEffect, useState } from 'react'
import {
  addList,
  getActiveDetection,
  getLibrary,
  resolveDetectionMetadata,
  saveDetection,
} from '../../shared/client'
import { isOlympusBibliotecaCatalogPage } from '../../shared/catalog-import/olympusbiblioteca'
import { isZonaTmoCatalogPage } from '../../shared/catalog-import/zonatmo'
import type { CatalogImportSnapshot } from '../../shared/catalog-import/types'
import { STORAGE_KEYS } from '../../shared/constants'
import type { DetectionDebugInfo } from '../../shared/messages'
import {
  getLocalizedListDefinitionLabel,
  getLocalizedListLabel,
  getLocalizedProgressLabel,
  getSortedLocalizedLists,
} from '../../shared/i18n/helpers'
import { useI18n } from '../../shared/i18n/useI18n'
import { buildLibraryUrl } from '../../shared/navigation'
import {
  hydrateDetectionWithMetadata,
  hydrateDetectionWithStoredProgress,
  shouldPreserveDetectedTitle,
} from '../../shared/metadata/detection-hydration'
import { getRandomTemporaryPoster } from '../../shared/mock-posters'
import { getResolvedProgressState, isDetectionAlreadyTracked } from '../../shared/progress'
import {
  findMatchingLibraryEntry,
  findMatchingLibraryEntryForMetadata,
  toLibraryEntries,
} from '../../shared/selectors'
import type { DetectionResult, MetadataCard, WatchLogSnapshot } from '../../shared/types'
import { normalizeTitle } from '../../shared/utils/normalize'
import type {
  CatalogImportProgressState,
  PopupMessageState,
  PopupPosterCandidate,
} from '../popup-types'
import {
  CREATE_NEW_LIST_OPTION,
  buildCatalogImportDetection,
  buildPopupListOptions,
  findExistingListByLabel,
  getDetectionProgressPercent,
  getEmptyDebug,
  getHostnameLabel,
  getInitialSnapshot,
  getPopupOtherTitles,
  getPopupTitleSuggestions,
  getPreferredCapturePoster,
  getSelectedListLabel,
  getRecentEntries,
  hasStoredOfficialPoster,
  inferCatalogListMediaType,
  mergePopupLists,
  readPopupLists,
  shouldResolveMetadataForPopup,
} from '../utils/popup-helpers'
import {
  runOlympusBibliotecaCatalogProbe,
  runPopupPosterProbe,
  runPopupScriptedDetection,
  runZonaTmoCatalogProbe,
} from '../utils/popup-probes'
import { getSiteTitleAliasCandidates } from '../../shared/detection/site-title-aliases'

function getActiveDetectionMessage(detection: DetectionResult | null): PopupMessageState {
  return {
    key: detection ? 'popup.suggestionReady' : 'popup.noSupportedMedia',
  }
}

export function usePopupApp() {
  const { locale, t } = useI18n()
  const [detection, setDetection] = useState<DetectionResult | null>(null)
  const [resolvedMetadata, setResolvedMetadata] = useState<MetadataCard | null>(null)
  const [debug, setDebug] = useState(getEmptyDebug)
  const [snapshot, setSnapshot] = useState<WatchLogSnapshot>(getInitialSnapshot)
  const [libraryHydrated, setLibraryHydrated] = useState(false)
  const [listOptions, setListOptions] = useState(() => mergePopupLists([]))
  const [selectedList, setSelectedList] = useState('library')
  const [favorite, setFavorite] = useState(false)
  const [messageState, setMessageState] = useState<PopupMessageState>({ key: 'common.loading' })
  const [busy, setBusy] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle')
  const [analyzing, setAnalyzing] = useState(false)
  const [catalogImportBusy, setCatalogImportBusy] = useState(false)
  const [catalogImportScanBusy, setCatalogImportScanBusy] = useState(false)
  const [targetTabId, setTargetTabId] = useState<number | null>(null)
  const [targetTabUrl, setTargetTabUrl] = useState<string | null>(null)
  const [capturePoster, setCapturePoster] = useState(() => getRandomTemporaryPoster())
  const [posterCandidates, setPosterCandidates] = useState<PopupPosterCandidate[]>([])
  const [selectedPosterUrl, setSelectedPosterUrl] = useState<string | null>(null)
  const [syncedDetectionSignature, setSyncedDetectionSignature] = useState<string | null>(null)
  const [catalogImportSnapshot, setCatalogImportSnapshot] = useState<CatalogImportSnapshot | null>(
    null,
  )
  const [catalogImportTarget, setCatalogImportTarget] =
    useState<string>(CREATE_NEW_LIST_OPTION)
  const [catalogImportNewListLabel, setCatalogImportNewListLabel] = useState('')
  const [catalogImportMergeConfirmed, setCatalogImportMergeConfirmed] = useState(false)
  const [catalogImportProgress, setCatalogImportProgress] =
    useState<CatalogImportProgressState | null>(null)
  const [catalogImportCompletedTarget, setCatalogImportCompletedTarget] = useState<{
    listId: string
    label: string
  } | null>(null)
  const [siteTitleAliases, setSiteTitleAliases] = useState<string[]>([])

  useEffect(() => {
    document.title = t('titles.popup')
  }, [t])

  async function loadDetection(forceRefresh = false): Promise<DetectionResult | null> {
    let tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
    if (tabs.length === 0) {
      tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    }

    const tab = tabs[0] ?? null
    const resolvedTabId = tab?.id ?? null
    const resolvedTabUrl = tab?.url ?? tab?.pendingUrl ?? null
    setTargetTabId(resolvedTabId)
    setTargetTabUrl(resolvedTabUrl)

    if (resolvedTabId === null) {
      setDebug({
        tabId: null,
        tabUrl: resolvedTabUrl,
        source: 'none',
        reason: 'popup-could-not-resolve-tab',
      })
      return null
    }

    if (forceRefresh) {
      const local = await runPopupScriptedDetection(resolvedTabId)
      setDebug({
        ...local.debug,
        tabUrl: local.debug.tabUrl ?? resolvedTabUrl,
      })
      return local.detection
    }

    let latestDebug: DetectionDebugInfo = {
      tabId: resolvedTabId,
      tabUrl: resolvedTabUrl,
      source: 'none',
      reason: 'waiting-for-detection',
    }

    for (let attempt = 0; attempt < 14; attempt += 1) {
      const active = await getActiveDetection(resolvedTabId)
      latestDebug = active.debug
      if (active.detection) {
        setDebug(active.debug)
        return active.detection
      }

      await new Promise((resolve) => window.setTimeout(resolve, 400))
    }

    const local = await runPopupScriptedDetection(resolvedTabId)
    if (local.detection) {
      setDebug({
        ...local.debug,
        tabUrl: local.debug.tabUrl ?? resolvedTabUrl,
      })
      return local.detection
    }

    setDebug(
      local.debug.reason
        ? {
            ...local.debug,
            tabUrl: local.debug.tabUrl ?? resolvedTabUrl,
          }
        : latestDebug,
    )
    return null
  }

  async function loadDetectionWithRetry(): Promise<DetectionResult | null> {
    const initialDetection = await loadDetection(false)
    if (initialDetection) {
      return initialDetection
    }

    await new Promise((resolve) => window.setTimeout(resolve, 1200))
    return loadDetection(true)
  }

  useEffect(() => {
    let cancelled = false

    void getLibrary()
      .then((response) => {
        if (cancelled) {
          return
        }

        setSnapshot(response.snapshot)
        setLibraryHydrated(true)
        setListOptions((current) => buildPopupListOptions(response.snapshot.lists, current))
      })
      .catch(() => {
        if (cancelled) {
          return
        }

        setLibraryHydrated(true)
        setMessageState({ key: 'popup.analyzeFailed' })
      })

    void readPopupLists()
      .then((lists) => {
        if (cancelled) {
          return
        }

        setListOptions(lists)
      })
      .catch(() => {
        if (cancelled) {
          return
        }

        setListOptions(mergePopupLists([]))
      })

    void loadDetectionWithRetry()
      .then((activeDetection) => {
        if (cancelled) {
          return
        }

        setDetection(activeDetection)
        setMessageState(getActiveDetectionMessage(activeDetection))
      })
      .catch(() => {
        if (cancelled) {
          return
        }

        setMessageState({ key: 'popup.analyzeFailed' })
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const handleStorageChange = async (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName !== 'local') {
        return
      }

      if (
        !(STORAGE_KEYS.lists in changes) &&
        !(STORAGE_KEYS.catalog in changes) &&
        !(STORAGE_KEYS.activity in changes)
      ) {
        return
      }

      const [response, lists] = await Promise.all([getLibrary(), readPopupLists()])
      setSnapshot(response.snapshot)
      setListOptions(buildPopupListOptions(response.snapshot.lists, lists))
      setLibraryHydrated(true)
    }

    chrome.storage.onChanged.addListener(handleStorageChange)

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const currentTabUrl = targetTabUrl ?? ''
    const isCatalogPage =
      targetTabUrl !== null &&
      (isZonaTmoCatalogPage(currentTabUrl) || isOlympusBibliotecaCatalogPage(currentTabUrl))

    if (targetTabId === null || !isCatalogPage) {
      setCatalogImportSnapshot(null)
      setCatalogImportProgress(null)
      return () => {
        cancelled = true
      }
    }

    const probe = isZonaTmoCatalogPage(currentTabUrl)
      ? runZonaTmoCatalogProbe(targetTabId)
      : runOlympusBibliotecaCatalogProbe(targetTabId)

    void probe.then((result) => {
      if (cancelled) {
        return
      }

      setCatalogImportSnapshot(result)
      if (!result) {
        setCatalogImportProgress(null)
      }
    })

    return () => {
      cancelled = true
    }
  }, [targetTabId, targetTabUrl])

  useEffect(() => {
    if (!catalogImportSnapshot) {
      setCatalogImportTarget(CREATE_NEW_LIST_OPTION)
      setCatalogImportNewListLabel('')
      setCatalogImportMergeConfirmed(false)
      setCatalogImportCompletedTarget(null)
      return
    }

    setCatalogImportTarget(CREATE_NEW_LIST_OPTION)
    setCatalogImportNewListLabel(catalogImportSnapshot.listLabel)
    setCatalogImportMergeConfirmed(false)
    setCatalogImportCompletedTarget(null)
    setCatalogImportProgress(null)
  }, [catalogImportSnapshot?.sourceUrl])

  const availableLists = getSortedLocalizedLists(
    buildPopupListOptions(snapshot.lists, listOptions),
    locale,
    t,
  )

  useEffect(() => {
    if (!catalogImportSnapshot) {
      return
    }

    setCatalogImportTarget((current) => {
      const currentIsExistingList = availableLists.some((list) => list.id === current)
      if (currentIsExistingList || current === CREATE_NEW_LIST_OPTION) {
        return current
      }

      return CREATE_NEW_LIST_OPTION
    })
    setCatalogImportNewListLabel((current) =>
      current.trim() ? current : catalogImportSnapshot.listLabel,
    )
  }, [catalogImportSnapshot, availableLists])

  useEffect(() => {
    setCatalogImportMergeConfirmed(false)

    if (!catalogImportBusy && catalogImportProgress?.stage === 'done') {
      setCatalogImportProgress(null)
      setCatalogImportCompletedTarget(null)
    }
  }, [catalogImportTarget, catalogImportNewListLabel, catalogImportBusy, catalogImportProgress?.stage])

  useEffect(() => {
    if (availableLists.length > 0 && !availableLists.some((list) => list.id === selectedList)) {
      const preferredDefault =
        availableLists.find((list) => list.id === 'library')?.id ?? availableLists[0].id
      setSelectedList(preferredDefault)
    }
  }, [availableLists, selectedList])

  useEffect(() => {
    if (detection) {
      setCapturePoster(getRandomTemporaryPoster())
      setSyncedDetectionSignature(null)
      setPosterCandidates([])
      setSelectedPosterUrl(null)
    }
  }, [detection?.normalizedTitle])

  useEffect(() => {
    let cancelled = false

    if (!detection) {
      setSiteTitleAliases([])
      return () => {
        cancelled = true
      }
    }

    void getSiteTitleAliasCandidates(detection.sourceSite, detection.title)
      .then((aliases) => {
        if (!cancelled) {
          setSiteTitleAliases(aliases)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSiteTitleAliases([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [detection?.sourceSite, detection?.title, detection?.normalizedTitle])

  useEffect(() => {
    let cancelled = false

    if (!detection || targetTabId === null) {
      setPosterCandidates([])
      setSelectedPosterUrl(null)
      return () => {
        cancelled = true
      }
    }

    void runPopupPosterProbe(targetTabId).then((candidates) => {
      if (cancelled) {
        return
      }

      setPosterCandidates(candidates)
      setSelectedPosterUrl((current) =>
        current && candidates.some((candidate) => candidate.url === current)
          ? current
          : candidates[0]?.url ?? null,
      )
    })

    return () => {
      cancelled = true
    }
  }, [detection?.normalizedTitle, targetTabId])

  const matchedLibraryEntryFromDetection = detection
    ? findMatchingLibraryEntry(snapshot, detection)
    : null
  const matchedLibraryEntryFromMetadata = resolvedMetadata
    ? findMatchingLibraryEntryForMetadata(snapshot, resolvedMetadata)
    : null
  const matchedLibraryEntry = matchedLibraryEntryFromMetadata ?? matchedLibraryEntryFromDetection
  const matchedLibraryEntryAlreadyTracked = matchedLibraryEntry
    ? isDetectionAlreadyTracked(
        matchedLibraryEntry.activity.currentProgress,
        matchedLibraryEntry.activity.status,
        detection ?? {
          season: undefined,
          episode: undefined,
          chapter: undefined,
        },
        {
          episodeCount: matchedLibraryEntry.catalog.episodeCount,
          chapterCount: matchedLibraryEntry.catalog.chapterCount,
        },
      )
    : false
  const shouldResolveMetadata = shouldResolveMetadataForPopup(
    detection,
    matchedLibraryEntryFromDetection,
  )
  const titleSuggestions = getPopupTitleSuggestions(
    detection,
    resolvedMetadata,
    matchedLibraryEntry,
    siteTitleAliases,
  )

  useEffect(() => {
    let cancelled = false

    if (!detection || !shouldResolveMetadata) {
      setResolvedMetadata(null)
      return () => {
        cancelled = true
      }
    }

    void resolveDetectionMetadata(detection)
      .then((metadata) => {
        if (cancelled) {
          return
        }

        setResolvedMetadata(metadata ?? null)

        if (!metadata) {
          return
        }

        setDetection((current) => {
          if (!current) {
            return current
          }

          const hydrated = hydrateDetectionWithMetadata(current, metadata)
          const nextDetection =
            matchedLibraryEntryFromDetection || shouldPreserveDetectedTitle(current.sourceSite)
              ? hydrated
              : {
                  ...hydrated,
                  title: metadata.title,
                  normalizedTitle: metadata.normalizedTitle,
                }

          if (
            current.title === nextDetection.title &&
            current.normalizedTitle === nextDetection.normalizedTitle &&
            current.mediaType === nextDetection.mediaType &&
            current.episodeTotal === nextDetection.episodeTotal &&
            current.chapterTotal === nextDetection.chapterTotal &&
            current.progressLabel === nextDetection.progressLabel
          ) {
            return current
          }

          return nextDetection
        })
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedMetadata(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    detection?.normalizedTitle,
    detection?.sourceSite,
    detection?.title,
    matchedLibraryEntryFromDetection?.catalog.updatedAt,
    matchedLibraryEntryFromDetection?.catalog.id,
    shouldResolveMetadata,
  ])

  useEffect(() => {
    if (!detection || !libraryHydrated) {
      setSaveState('idle')
      return
    }

    const signature = `${targetTabId ?? 'unknown'}:${detection.normalizedTitle}:${detection.mediaType}`
    if (syncedDetectionSignature === signature) {
      return
    }

    setSaveState(matchedLibraryEntryAlreadyTracked ? 'saved' : 'idle')

    if (matchedLibraryEntry) {
      setSelectedList(matchedLibraryEntry.activity.status)
      setFavorite(matchedLibraryEntry.activity.favorite)

      const shouldPreserveSourceTitle = shouldPreserveDetectedTitle(detection.sourceSite)
      const hydratedDetection = hydrateDetectionWithStoredProgress(
        shouldPreserveSourceTitle
          ? detection
          : {
              ...detection,
              title: matchedLibraryEntry.catalog.title,
              normalizedTitle: matchedLibraryEntry.catalog.normalizedTitle,
              mediaType: matchedLibraryEntry.catalog.mediaType,
            },
        getResolvedProgressState(
          matchedLibraryEntry.activity.currentProgress,
          matchedLibraryEntry.activity.status,
          {
            episodeCount: matchedLibraryEntry.catalog.episodeCount,
            chapterCount: matchedLibraryEntry.catalog.chapterCount,
          },
        ),
      )

      if (
        hydratedDetection.title !== detection.title ||
        hydratedDetection.normalizedTitle !== detection.normalizedTitle ||
        hydratedDetection.mediaType !== detection.mediaType ||
        hydratedDetection.season !== detection.season ||
        hydratedDetection.episode !== detection.episode ||
        hydratedDetection.episodeTotal !== detection.episodeTotal ||
        hydratedDetection.chapter !== detection.chapter ||
        hydratedDetection.chapterTotal !== detection.chapterTotal ||
        hydratedDetection.progressLabel !== detection.progressLabel
      ) {
        setDetection((current) => {
          if (!current) {
            return current
          }

          return {
            ...current,
            ...hydratedDetection,
          }
        })
      }
    } else {
      setSelectedList('library')
      setFavorite(false)
    }

    setSyncedDetectionSignature(signature)
  }, [
    detection,
    libraryHydrated,
    matchedLibraryEntry,
    matchedLibraryEntryAlreadyTracked,
    syncedDetectionSignature,
    targetTabId,
  ])

  async function handleRetryAnalysis(): Promise<void> {
    setAnalyzing(true)
    setMessageState({ key: 'popup.reanalyzing' })

    try {
      const activeDetection = await loadDetection(true)
      setDetection(activeDetection)
      setMessageState({
        key: activeDetection ? 'popup.suggestionReady' : 'popup.stillNoSupportedMedia',
      })
    } finally {
      setAnalyzing(false)
    }
  }

  const selectedPosterCandidate =
    posterCandidates.find((candidate) => candidate.url === selectedPosterUrl) ??
    posterCandidates[0] ??
    null
  const hasOfficialPoster =
    Boolean(resolvedMetadata?.poster) || hasStoredOfficialPoster(matchedLibraryEntry)
  const shouldShowUnofficialPosterUI = !hasOfficialPoster && posterCandidates.length > 0
  const selectedUnofficialPoster = shouldShowUnofficialPosterUI
    ? selectedPosterCandidate?.url ?? null
    : null

  async function handleSave(): Promise<void> {
    if (!detection) {
      return
    }

    setBusy(true)
    setMessageState({ key: 'popup.saving' })

    try {
      const response = await saveDetection({
        detection,
        listId: selectedList,
        favorite,
        metadata: resolvedMetadata ?? undefined,
        posterOverride: selectedUnofficialPoster ?? undefined,
      })

      setSnapshot(response.snapshot)
      setListOptions((current) => buildPopupListOptions(response.snapshot.lists, current))
      setSaveState('saved')
      setMessageState({
        key: 'popup.savedUnder',
        params: {
          label: getLocalizedListLabel(response.snapshot.lists, selectedList, t),
        },
      })
    } finally {
      setBusy(false)
    }
  }

  const saveButtonLabel =
    saveState === 'saved'
      ? 'Progreso actualizado'
      : matchedLibraryEntry
        ? t('popup.saveProgress')
        : t('popup.saveSuggestion')

  async function resolveCatalogImportList(): Promise<{ listId: string; label: string }> {
    if (catalogImportTarget !== CREATE_NEW_LIST_OPTION) {
      const existingList = availableLists.find((list) => list.id === catalogImportTarget)
      return {
        listId: existingList?.id ?? catalogImportTarget,
        label: existingList
          ? getLocalizedListDefinitionLabel(existingList, t)
          : getLocalizedListLabel(availableLists, catalogImportTarget, t),
      }
    }

    const trimmedLabel =
      catalogImportNewListLabel.trim() || catalogImportSnapshot?.listLabel.trim() || ''
    if (!trimmedLabel) {
      throw new Error(t('popup.catalogImportNameRequired'))
    }

    const matchedList = findExistingListByLabel(availableLists, trimmedLabel, t)
    if (matchedList) {
      if (!catalogImportMergeConfirmed) {
        throw new Error(
          t('popup.catalogImportDuplicateWarning', {
            label: getLocalizedListDefinitionLabel(matchedList, t),
          }),
        )
      }

      return {
        listId: matchedList.id,
        label: getLocalizedListDefinitionLabel(matchedList, t),
      }
    }

    const created = await addList(trimmedLabel)
    setSnapshot(created.snapshot)
    setListOptions((current) => buildPopupListOptions(created.snapshot.lists, current))
    setCatalogImportTarget(created.list.id)
    setCatalogImportNewListLabel(trimmedLabel)

    return {
      listId: created.list.id,
      label: getLocalizedListDefinitionLabel(created.list, t),
    }
  }

  async function importCatalogSnapshot(snapshotToRecover: CatalogImportSnapshot): Promise<void> {
    if (snapshotToRecover.items.length === 0) {
      console.warn('[WatchLog][CatalogImport] Empty snapshot, nothing to recover', snapshotToRecover)
      return
    }

    const total = snapshotToRecover.items.length
    const listMediaType = inferCatalogListMediaType(snapshotToRecover.items)
    console.info('[WatchLog][CatalogImport] Import start', {
      sourceSite: snapshotToRecover.sourceSite,
      listLabel: snapshotToRecover.listLabel,
      total,
      inferredMediaType: listMediaType,
    })
    setCatalogImportBusy(true)
    setCatalogImportCompletedTarget(null)
    setCatalogImportProgress({
      stage: 'queueing',
      processed: 0,
      total,
    })

    try {
      const destination = await resolveCatalogImportList()
      console.info('[WatchLog][CatalogImport] Destination resolved', destination)
      let latestSnapshot = snapshot
      const importSummary = {
        created: 0,
        moved: 0,
        reused: 0,
        omitted: 0,
      }

      for (let index = 0; index < snapshotToRecover.items.length; index += 1) {
        const item = snapshotToRecover.items[index]
        console.debug('[WatchLog][CatalogImport] Inspecting item', {
          index: index + 1,
          total,
          title: item.title,
          normalizedTitle: item.normalizedTitle,
          sourceUrl: item.sourceUrl,
          mediaType: item.mediaType,
        })
        const importedDetection = buildCatalogImportDetection(
          item,
          snapshotToRecover.sourceSite,
          listMediaType,
        )
        const existingWithSameType = toLibraryEntries(latestSnapshot).find((entry) => {
          return (
            entry.catalog.mediaType === importedDetection.mediaType &&
            entry.catalog.normalizedTitle === importedDetection.normalizedTitle
          )
        })

        if (existingWithSameType?.activity.status === destination.listId) {
          importSummary.omitted += 1
          console.debug('[WatchLog][CatalogImport] Omitted already saved item', {
            title: item.title,
            destination: destination.listId,
          })
          setCatalogImportProgress({
            stage: 'queueing',
            processed: index + 1,
            total,
            label: destination.label,
          })
          continue
        }

        setCatalogImportProgress({
          stage: 'queueing',
          processed: index,
          total,
          label: destination.label,
        })

        const previousCatalogCount = latestSnapshot.catalog.length
        const previousActivity = latestSnapshot.activity.find(
          (activity) => activity.catalogId === existingWithSameType?.catalog.id,
        )
        const response = await saveDetection({
          detection: importedDetection,
          listId: destination.listId,
          metadataSyncStatus: 'pending',
          skipMetadataLookup: true,
          disableTemporaryPoster: true,
        })
        console.debug('[WatchLog][CatalogImport] Saved item', {
          title: item.title,
          before: previousCatalogCount,
          after: response.snapshot.catalog.length,
        })

        if (response.snapshot.catalog.length > previousCatalogCount) {
          importSummary.created += 1
        } else if (previousActivity && previousActivity.status !== destination.listId) {
          importSummary.moved += 1
        } else {
          importSummary.reused += 1
        }

        latestSnapshot = response.snapshot

        setCatalogImportProgress({
          stage: 'queueing',
          processed: index + 1,
          total,
          label: destination.label,
        })
      }

      setSnapshot(latestSnapshot)
      setListOptions((current) => buildPopupListOptions(latestSnapshot.lists, current))
      setSelectedList(destination.listId)
      setCatalogImportCompletedTarget(destination)

      setCatalogImportProgress({
        stage: 'done',
        processed: total,
        total,
        label: destination.label,
        summary: importSummary,
      })
      console.info('[WatchLog][CatalogImport] Import done', {
        destination,
        summary: importSummary,
      })
    } catch (error) {
      console.error('[WatchLog][CatalogImport] Import failed', error)
      setCatalogImportProgress({
        stage: 'error',
        processed: 0,
        total,
        reason: error instanceof Error ? error.message : 'catalog-import-failed',
      })
    } finally {
      setCatalogImportBusy(false)
    }
  }

  async function handleRecoverCatalog(): Promise<void> {
    if (!catalogImportSnapshot) {
      return
    }

    await importCatalogSnapshot(catalogImportSnapshot)
  }

  async function handleScanAndRecoverOlympusCatalog(): Promise<void> {
    if (targetTabId === null) {
      console.warn('[WatchLog][Olympus] Scan requested without active tab id')
      return
    }

    console.info('[WatchLog][Olympus] Scan start', {
      tabId: targetTabId,
      tabUrl: targetTabUrl,
    })
    setCatalogImportScanBusy(true)
    setCatalogImportBusy(true)
    setCatalogImportProgress({
      stage: 'queueing',
      processed: 0,
      total: 0,
      label: t('popup.catalogImportTitle'),
    })

    try {
      const snapshotFromPage = await runOlympusBibliotecaCatalogProbe(targetTabId)
      console.info('[WatchLog][Olympus] Scan probe result', {
        found: snapshotFromPage?.items.length ?? 0,
        listLabel: snapshotFromPage?.listLabel ?? null,
        sourceUrl: snapshotFromPage?.sourceUrl ?? null,
      })
      if (!snapshotFromPage || snapshotFromPage.items.length === 0) {
        console.warn('[WatchLog][Olympus] No recoverable items found')
        throw new Error('No se encontró contenido recuperable en Olympus Biblioteca.')
      }

      setCatalogImportSnapshot(snapshotFromPage)
      await importCatalogSnapshot(snapshotFromPage)
    } catch (error) {
      console.error('[WatchLog][Olympus] Scan failed', error)
      setCatalogImportProgress({
        stage: 'error',
        processed: 0,
        total: 0,
        reason: error instanceof Error ? error.message : 'olympus-catalog-scan-failed',
      })
    } finally {
      setCatalogImportBusy(false)
      setCatalogImportScanBusy(false)
    }
  }

  async function openLibrary(target?: {
    viewId?: string
    catalogId?: string
    query?: string
  }): Promise<void> {
    await chrome.tabs.create({
      url: buildLibraryUrl(chrome.runtime.getURL('library.html'), target),
    })
    window.close()
  }

  async function handleOpenMatchedEntry(): Promise<void> {
    if (!matchedLibraryEntry) {
      return
    }

    await openLibrary({
      viewId: matchedLibraryEntry.activity.status,
      catalogId: matchedLibraryEntry.catalog.id,
      query: matchedLibraryEntry.catalog.title,
    })
  }

  function handleSelectSuggestedTitle(title: string): void {
    if (!detection || !title.trim()) {
      return
    }

    const nextTitle = title.trim()
    setDetection((current) => {
      if (!current) {
        return current
      }

      if (current.title === nextTitle && current.normalizedTitle === normalizeTitle(nextTitle)) {
        return current
      }

      return {
        ...current,
        title: nextTitle,
        normalizedTitle: normalizeTitle(nextTitle),
      }
    })
    setResolvedMetadata(null)
  }

  async function handleCatalogImportAction(): Promise<void> {
    if (catalogImportCompletedTarget && catalogImportProgress?.stage === 'done') {
      await openLibrary({
        viewId: catalogImportCompletedTarget.listId,
      })
      return
    }

    await handleRecoverCatalog()
  }

  const catalogImportDuplicateList =
    catalogImportSnapshot && catalogImportTarget === CREATE_NEW_LIST_OPTION
      ? findExistingListByLabel(
          availableLists,
          catalogImportNewListLabel.trim() || catalogImportSnapshot.listLabel,
          t,
        ) ?? null
      : null
  const catalogImportCount =
    catalogImportSnapshot?.reportedCount ?? catalogImportSnapshot?.visibleCount ?? 0
  const catalogImportPreviewItems = catalogImportSnapshot?.items.slice(0, 4) ?? []
  const catalogImportNeedsNewListName = catalogImportTarget === CREATE_NEW_LIST_OPTION
  const catalogImportCanRun =
    !catalogImportBusy &&
    (!catalogImportNeedsNewListName || Boolean(catalogImportNewListLabel.trim())) &&
    (!catalogImportDuplicateList || catalogImportMergeConfirmed)
  const isOlympusCatalogPage =
    targetTabUrl !== null && isOlympusBibliotecaCatalogPage(targetTabUrl)
  const catalogImportButtonLabel =
    catalogImportCompletedTarget && catalogImportProgress?.stage === 'done'
      ? t('popup.catalogImportOpenRecovered')
      : t('popup.catalogImportAction')
  const catalogImportStatusMessage = (() => {
    if (!catalogImportSnapshot) {
      return null
    }

    if (catalogImportProgress?.stage === 'queueing') {
      return t('popup.catalogImportQueueing', {
        current: catalogImportProgress.processed,
        total: catalogImportProgress.total,
      })
    }

    if (catalogImportProgress?.stage === 'done') {
      return t('popup.catalogImportDone', {
        count: catalogImportProgress.total,
        label: catalogImportProgress.label ?? catalogImportSnapshot.listLabel,
      })
    }

    if (catalogImportProgress?.stage === 'error') {
      return t('popup.catalogImportFailed', {
        reason: catalogImportProgress.reason ?? 'catalog-import-failed',
      })
    }

    return t('popup.catalogImportSummary', {
      count: catalogImportCount,
      label: catalogImportSnapshot.listLabel,
    })
  })()
  const catalogImportHintMessage = catalogImportSnapshot
    ? catalogImportProgress?.stage === 'done' && catalogImportProgress.summary
      ? t('popup.catalogImportDoneBreakdown', {
          created: catalogImportProgress.summary.created,
          moved: catalogImportProgress.summary.moved,
          reused: catalogImportProgress.summary.reused,
          omitted: catalogImportProgress.summary.omitted,
        })
      : catalogImportDuplicateList
        ? t('popup.catalogImportDuplicateWarning', {
            label: getLocalizedListDefinitionLabel(catalogImportDuplicateList, t),
          })
        : t('popup.catalogImportNameSuggestion')
    : null

  const recentEntries = getRecentEntries(snapshot)
  const sourceHost = detection ? getHostnameLabel(detection.url) : ''
  const currentListLabel = getSelectedListLabel(availableLists, selectedList, t)
  const captureProgressPercent = detection ? getDetectionProgressPercent(detection) : 0
  const detectionProgressLabel = detection
    ? getLocalizedProgressLabel(
        {
          season: detection.season,
          episode: detection.episode,
          episodeTotal: detection.episodeTotal,
          chapter: detection.chapter,
          chapterTotal: detection.chapterTotal,
          progressText: detection.progressLabel,
        },
        t,
      )
    : ''
  const activeSessionsLabel = t(
    recentEntries.length === 1 ? 'popup.activeSession.one' : 'popup.activeSession.other',
    { count: recentEntries.length },
  )
  const captureInitials = detection ? detection.title : 'WL'
  const fallbackCapturePoster = detection
    ? getPreferredCapturePoster(
        matchedLibraryEntry,
        resolvedMetadata,
        selectedUnofficialPoster,
        capturePoster,
      )
    : '/mock-posters/poster-01.svg'
  const popupOtherTitles = detection
    ? getPopupOtherTitles(
        detection.title,
        matchedLibraryEntry?.catalog.aliases,
        resolvedMetadata?.aliases,
      )
    : []
  const message = t(messageState.key, messageState.params)

  return {
    actions: {
      changeCatalogImportMergeConfirmed: setCatalogImportMergeConfirmed,
      changeCatalogImportNewListLabel: setCatalogImportNewListLabel,
      changeCatalogImportTarget: setCatalogImportTarget,
      changeDetectionProgress: (progressLabel: string) =>
        setDetection((current) =>
          current
            ? {
                ...current,
                progressLabel,
              }
            : current,
        ),
      openLibrary: () => void openLibrary(),
      openMatchedEntry: () => void handleOpenMatchedEntry(),
      retryAnalysis: () => void handleRetryAnalysis(),
      runCatalogImportAction: () => void handleCatalogImportAction(),
      save: () => void handleSave(),
      scanOlympusCatalog: () => void handleScanAndRecoverOlympusCatalog(),
      selectList: setSelectedList,
      selectPoster: setSelectedPosterUrl,
      selectSuggestedTitle: handleSelectSuggestedTitle,
      toggleFavorite: () => setFavorite((value) => !value),
    },
    activeSessionsLabel,
    analyzing,
    availableListOptions: availableLists.map((list) => ({
      value: list.id,
      label: getLocalizedListDefinitionLabel(list, t),
    })),
    availableLists,
    busy,
    captureInitials,
    captureProgressPercent,
    catalogImport: {
      buttonLabel: catalogImportButtonLabel,
      canRun: catalogImportCanRun,
      completedTarget: catalogImportCompletedTarget,
      count: catalogImportCount,
      duplicateList: catalogImportDuplicateList,
      hintMessage: catalogImportHintMessage,
      isBusy: catalogImportBusy,
      isOlympusCatalogPage,
      mergeConfirmed: catalogImportMergeConfirmed,
      needsNewListName: catalogImportNeedsNewListName,
      newListLabel: catalogImportNewListLabel,
      previewItems: catalogImportPreviewItems,
      progress: catalogImportProgress,
      scanBusy: catalogImportScanBusy,
      snapshot: catalogImportSnapshot,
      statusMessage: catalogImportStatusMessage,
      target: catalogImportTarget,
    },
    currentListLabel,
    debug,
    detection,
    detectionProgressLabel,
    fallbackCapturePoster,
    favorite,
    matchedLibraryEntry,
    message,
    popupOtherTitles,
    posterCandidates,
    recentEntries,
    saveButtonLabel,
    saveState,
    selectedList,
    selectedPosterCandidateUrl: selectedPosterCandidate?.url ?? null,
    selectedUnofficialPoster,
    shouldShowUnofficialPosterUI,
    sourceHost,
    t,
    targetTabId,
    titleSuggestions,
  }
}

export type PopupAppModel = ReturnType<typeof usePopupApp>
