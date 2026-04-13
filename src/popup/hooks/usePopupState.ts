/** Owns the local popup controller state so specialized hooks can focus on behavior instead of state declaration noise. */
import { useState } from 'react'
import type { CatalogImportSnapshot } from '../../shared/catalog-import/types'
import type { DetectionResult, MetadataCard, WatchLogSnapshot } from '../../shared/types'
import { getRandomTemporaryPoster } from '../../shared/mock-posters'
import type {
  CatalogImportProgressState,
  PopupMessageState,
  PopupPosterCandidate,
} from '../popup-types'
import { CREATE_NEW_LIST_OPTION, getEmptyDebug, getInitialSnapshot, mergePopupLists } from '../utils/popup-helpers'

export function usePopupState() {
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
  const [catalogImportSnapshot, setCatalogImportSnapshot] = useState<CatalogImportSnapshot | null>(null)
  const [catalogImportTarget, setCatalogImportTarget] = useState<string>(CREATE_NEW_LIST_OPTION)
  const [catalogImportNewListLabel, setCatalogImportNewListLabel] = useState('')
  const [catalogImportMergeConfirmed, setCatalogImportMergeConfirmed] = useState(false)
  const [catalogImportProgress, setCatalogImportProgress] =
    useState<CatalogImportProgressState | null>(null)
  const [catalogImportCompletedTarget, setCatalogImportCompletedTarget] = useState<{
    listId: string
    label: string
  } | null>(null)
  const [siteTitleAliases, setSiteTitleAliases] = useState<string[]>([])

  return {
    analyzing,
    busy,
    capturePoster,
    catalogImportBusy,
    catalogImportCompletedTarget,
    catalogImportMergeConfirmed,
    catalogImportNewListLabel,
    catalogImportProgress,
    catalogImportScanBusy,
    catalogImportSnapshot,
    catalogImportTarget,
    debug,
    detection,
    favorite,
    libraryHydrated,
    listOptions,
    messageState,
    posterCandidates,
    resolvedMetadata,
    saveState,
    selectedList,
    selectedPosterUrl,
    siteTitleAliases,
    snapshot,
    syncedDetectionSignature,
    targetTabId,
    targetTabUrl,
    setAnalyzing,
    setBusy,
    setCapturePoster,
    setCatalogImportBusy,
    setCatalogImportCompletedTarget,
    setCatalogImportMergeConfirmed,
    setCatalogImportNewListLabel,
    setCatalogImportProgress,
    setCatalogImportScanBusy,
    setCatalogImportSnapshot,
    setCatalogImportTarget,
    setDebug,
    setDetection,
    setFavorite,
    setLibraryHydrated,
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
  }
}

export type PopupStateModel = ReturnType<typeof usePopupState>
