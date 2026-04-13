/** Handles popup tab detection, metadata hydration, poster probing and save behavior as one coherent feature slice. */
import { useEffect } from 'react'
import { getActiveDetection, resolveDetectionMetadata, saveDetection } from '../../shared/client'
import { getSiteTitleAliasCandidates } from '../../shared/detection/site-title-aliases'
import {
  getLocalizedListLabel,
} from '../../shared/i18n/helpers'
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
} from '../../shared/selectors'
import type { DetectionResult } from '../../shared/types'
import { normalizeTitle } from '../../shared/utils/normalize'
import type { DetectionDebugInfo } from '../../shared/messages'
import type { PopupStateModel } from './usePopupState'
import type { PopupTranslate } from '../utils/popup-helpers'
import {
  buildPopupListOptions,
  getPopupTitleSuggestions,
  hasStoredOfficialPoster,
  shouldResolveMetadataForPopup,
} from '../utils/popup-helpers'
import { runPopupPosterProbe, runPopupScriptedDetection } from '../utils/popup-probes'

function getActiveDetectionMessage(detection: DetectionResult | null) {
  return {
    key: detection ? 'popup.suggestionReady' : 'popup.noSupportedMedia',
  } as const
}

interface UsePopupDetectionOptions {
  state: PopupStateModel
  t: PopupTranslate
}

export function usePopupDetection({ state, t }: UsePopupDetectionOptions) {
  const {
    detection,
    favorite,
    libraryHydrated,
    resolvedMetadata,
    saveState,
    selectedList,
    selectedPosterUrl,
    siteTitleAliases,
    snapshot,
    syncedDetectionSignature,
    targetTabId,
    setAnalyzing,
    setBusy,
    setCapturePoster,
    setDebug,
    setDetection,
    setFavorite,
    setListOptions,
    setMessageState,
    setPosterCandidates,
    setResolvedMetadata,
    setSaveState,
    setSelectedList,
    setSelectedPosterUrl,
    setSiteTitleAliases,
    setSnapshot,
    setSyncedDetectionSignature,
    setTargetTabId,
    setTargetTabUrl,
  } = state

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

    void loadDetectionWithRetry()
      .then((activeDetection) => {
        if (!cancelled) {
          setDetection(activeDetection)
          setMessageState(getActiveDetectionMessage(activeDetection))
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMessageState({ key: 'popup.analyzeFailed' })
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

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

  const selectedPosterCandidate =
    state.posterCandidates.find((candidate) => candidate.url === selectedPosterUrl) ??
    state.posterCandidates[0] ??
    null
  const hasOfficialPoster =
    Boolean(resolvedMetadata?.poster) || hasStoredOfficialPoster(matchedLibraryEntry)
  const shouldShowUnofficialPosterUI = !hasOfficialPoster && state.posterCandidates.length > 0
  const selectedUnofficialPoster = shouldShowUnofficialPosterUI
    ? selectedPosterCandidate?.url ?? null
    : null

  async function retryAnalysis(): Promise<void> {
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

  async function save(): Promise<void> {
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

  function selectSuggestedTitle(title: string): void {
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

  return {
    matchedLibraryEntry,
    saveButtonLabel,
    selectedPosterCandidateUrl: selectedPosterCandidate?.url ?? null,
    selectedUnofficialPoster,
    shouldShowUnofficialPosterUI,
    titleSuggestions,
    actions: {
      retryAnalysis: () => void retryAnalysis(),
      save: () => void save(),
      selectSuggestedTitle,
    },
  }
}
