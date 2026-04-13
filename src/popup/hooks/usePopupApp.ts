/** Assembles the popup feature hooks into the view model consumed by the popup UI. */
import { useEffect } from 'react'
import { getLocalizedListDefinitionLabel, getLocalizedProgressLabel, getSortedLocalizedLists } from '../../shared/i18n/helpers'
import { useI18n } from '../../shared/i18n/useI18n'
import { buildLibraryUrl } from '../../shared/navigation'
import { buildPopupListOptions, getDetectionProgressPercent, getHostnameLabel, getPopupOtherTitles, getPreferredCapturePoster, getRecentEntries, getSelectedListLabel } from '../utils/popup-helpers'
import { usePopupCatalogImport } from './usePopupCatalogImport'
import { usePopupDetection } from './usePopupDetection'
import { usePopupLibrarySync } from './usePopupLibrarySync'
import { usePopupState } from './usePopupState'

export function usePopupApp() {
  const { locale, t } = useI18n()
  const state = usePopupState()

  useEffect(() => {
    document.title = t('titles.popup')
  }, [t])

  usePopupLibrarySync({ state })

  const availableLists = getSortedLocalizedLists(
    buildPopupListOptions(state.snapshot.lists, state.listOptions),
    locale,
    t,
  )

  const detection = usePopupDetection({ state, t })
  const catalogImport = usePopupCatalogImport({
    availableLists,
    state,
    t,
  })

  useEffect(() => {
    if (availableLists.length > 0 && !availableLists.some((list) => list.id === state.selectedList)) {
      const preferredDefault =
        availableLists.find((list) => list.id === 'library')?.id ?? availableLists[0].id
      state.setSelectedList(preferredDefault)
    }
  }, [availableLists, state.selectedList])

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

  async function openMatchedEntry(): Promise<void> {
    if (!detection.matchedLibraryEntry) {
      return
    }

    await openLibrary({
      viewId: detection.matchedLibraryEntry.activity.status,
      catalogId: detection.matchedLibraryEntry.catalog.id,
      query: detection.matchedLibraryEntry.catalog.title,
    })
  }

  async function runCatalogImportAction(): Promise<void> {
    if (catalogImport.completedTarget && catalogImport.progress?.stage === 'done') {
      await openLibrary({
        viewId: catalogImport.completedTarget.listId,
      })
      return
    }

    catalogImport.actions.recoverCatalog()
  }

  const recentEntries = getRecentEntries(state.snapshot)
  const sourceHost = state.detection ? getHostnameLabel(state.detection.url) : ''
  const currentListLabel = getSelectedListLabel(availableLists, state.selectedList, t)
  const captureProgressPercent = state.detection ? getDetectionProgressPercent(state.detection) : 0
  const detectionProgressLabel = state.detection
    ? getLocalizedProgressLabel(
        {
          season: state.detection.season,
          episode: state.detection.episode,
          episodeTotal: state.detection.episodeTotal,
          chapter: state.detection.chapter,
          chapterTotal: state.detection.chapterTotal,
          progressText: state.detection.progressLabel,
        },
        t,
      )
    : ''
  const activeSessionsLabel = t(
    recentEntries.length === 1 ? 'popup.activeSession.one' : 'popup.activeSession.other',
    { count: recentEntries.length },
  )
  const captureInitials = state.detection ? state.detection.title : 'WL'
  const fallbackCapturePoster = state.detection
    ? getPreferredCapturePoster(
        detection.matchedLibraryEntry,
        state.resolvedMetadata,
        detection.selectedUnofficialPoster,
        state.capturePoster,
      )
    : '/mock-posters/poster-01.svg'
  const popupOtherTitles = state.detection
    ? getPopupOtherTitles(
        state.detection.title,
        detection.matchedLibraryEntry?.catalog.aliases,
        state.resolvedMetadata?.aliases,
      )
    : []
  const message = t(state.messageState.key, state.messageState.params)

  return {
    actions: {
      changeCatalogImportMergeConfirmed: catalogImport.actions.changeMergeConfirmed,
      changeCatalogImportNewListLabel: catalogImport.actions.changeNewListLabel,
      changeCatalogImportTarget: catalogImport.actions.changeTarget,
      changeDetectionProgress: (progressLabel: string) =>
        state.setDetection((current) =>
          current
            ? {
                ...current,
                progressLabel,
              }
            : current,
        ),
      openLibrary: () => void openLibrary(),
      openMatchedEntry: () => void openMatchedEntry(),
      retryAnalysis: detection.actions.retryAnalysis,
      runCatalogImportAction: () => void runCatalogImportAction(),
      save: detection.actions.save,
      scanOlympusCatalog: catalogImport.actions.scanOlympusCatalog,
      selectList: state.setSelectedList,
      selectPoster: state.setSelectedPosterUrl,
      selectSuggestedTitle: detection.actions.selectSuggestedTitle,
      toggleFavorite: () => state.setFavorite((value) => !value),
    },
    activeSessionsLabel,
    analyzing: state.analyzing,
    availableListOptions: availableLists.map((list) => ({
      value: list.id,
      label: getLocalizedListDefinitionLabel(list, t),
    })),
    availableLists,
    busy: state.busy,
    captureInitials,
    captureProgressPercent,
    catalogImport: {
      buttonLabel: catalogImport.buttonLabel,
      canRun: catalogImport.canRun,
      completedTarget: catalogImport.completedTarget,
      count: catalogImport.count,
      duplicateList: catalogImport.duplicateList,
      hintMessage: catalogImport.hintMessage,
      isBusy: state.catalogImportBusy,
      isOlympusCatalogPage: catalogImport.isOlympusCatalogPage,
      mergeConfirmed: state.catalogImportMergeConfirmed,
      needsNewListName: catalogImport.needsNewListName,
      newListLabel: state.catalogImportNewListLabel,
      previewItems: catalogImport.previewItems,
      progress: catalogImport.progress,
      scanBusy: state.catalogImportScanBusy,
      snapshot: catalogImport.snapshot,
      statusMessage: catalogImport.statusMessage,
      target: catalogImport.target,
    },
    currentListLabel,
    debug: state.debug,
    detection: state.detection,
    detectionProgressLabel,
    fallbackCapturePoster,
    favorite: state.favorite,
    matchedLibraryEntry: detection.matchedLibraryEntry,
    message,
    popupOtherTitles,
    posterCandidates: state.posterCandidates,
    recentEntries,
    saveButtonLabel: detection.saveButtonLabel,
    saveState: state.saveState,
    selectedList: state.selectedList,
    selectedPosterCandidateUrl: detection.selectedPosterCandidateUrl,
    selectedUnofficialPoster: detection.selectedUnofficialPoster,
    shouldShowUnofficialPosterUI: detection.shouldShowUnofficialPosterUI,
    sourceHost,
    t,
    targetTabId: state.targetTabId,
    titleSuggestions: detection.titleSuggestions,
  }
}

export type PopupAppModel = ReturnType<typeof usePopupApp>
