/** Owns popup catalog recovery so import-specific state and side effects stay isolated from the main popup controller. */
import { useEffect } from 'react'
import { addList, saveDetection } from '../../shared/client'
import { isOlympusBibliotecaCatalogPage } from '../../shared/catalog-import/olympusbiblioteca'
import { isZonaTmoCatalogPage } from '../../shared/catalog-import/zonatmo'
import type { CatalogImportSnapshot } from '../../shared/catalog-import/types'
import {
  getLocalizedListDefinitionLabel,
  getLocalizedListLabel,
} from '../../shared/i18n/helpers'
import { toLibraryEntries } from '../../shared/selectors'
import type { WatchListDefinition } from '../../shared/types'
import type { PopupStateModel } from './usePopupState'
import type { PopupTranslate } from '../utils/popup-helpers'
import {
  CREATE_NEW_LIST_OPTION,
  buildCatalogImportDetection,
  buildPopupListOptions,
  findExistingListByLabel,
  inferCatalogListMediaType,
} from '../utils/popup-helpers'
import {
  runOlympusBibliotecaCatalogProbe,
  runZonaTmoCatalogProbe,
} from '../utils/popup-probes'

interface UsePopupCatalogImportOptions {
  availableLists: WatchListDefinition[]
  state: PopupStateModel
  t: PopupTranslate
}

export function usePopupCatalogImport({
  availableLists,
  state,
  t,
}: UsePopupCatalogImportOptions) {
  const {
    catalogImportBusy,
    catalogImportCompletedTarget,
    catalogImportMergeConfirmed,
    catalogImportNewListLabel,
    catalogImportProgress,
    catalogImportSnapshot,
    catalogImportTarget,
    snapshot,
    targetTabId,
    targetTabUrl,
    setCatalogImportBusy,
    setCatalogImportCompletedTarget,
    setCatalogImportMergeConfirmed,
    setCatalogImportNewListLabel,
    setCatalogImportProgress,
    setCatalogImportScanBusy,
    setCatalogImportSnapshot,
    setCatalogImportTarget,
    setListOptions,
    setSelectedList,
    setSnapshot,
  } = state

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
  }, [catalogImportBusy, catalogImportNewListLabel, catalogImportProgress?.stage, catalogImportTarget])

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
    } catch (error) {
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

  async function recoverCatalog(): Promise<void> {
    if (catalogImportSnapshot) {
      await importCatalogSnapshot(catalogImportSnapshot)
    }
  }

  async function scanOlympusCatalog(): Promise<void> {
    if (targetTabId === null) {
      console.warn('[WatchLog][Olympus] Scan requested without active tab id')
      return
    }

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
      if (!snapshotFromPage || snapshotFromPage.items.length === 0) {
        throw new Error('No se encontró contenido recuperable en Olympus Biblioteca.')
      }

      setCatalogImportSnapshot(snapshotFromPage)
      await importCatalogSnapshot(snapshotFromPage)
    } catch (error) {
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

  const duplicateList =
    catalogImportSnapshot && catalogImportTarget === CREATE_NEW_LIST_OPTION
      ? findExistingListByLabel(
          availableLists,
          catalogImportNewListLabel.trim() || catalogImportSnapshot.listLabel,
          t,
        ) ?? null
      : null
  const count = catalogImportSnapshot?.reportedCount ?? catalogImportSnapshot?.visibleCount ?? 0
  const previewItems = catalogImportSnapshot?.items.slice(0, 4) ?? []
  const needsNewListName = catalogImportTarget === CREATE_NEW_LIST_OPTION
  const canRun =
    !catalogImportBusy &&
    (!needsNewListName || Boolean(catalogImportNewListLabel.trim())) &&
    (!duplicateList || catalogImportMergeConfirmed)
  const isOlympusCatalogPage =
    targetTabUrl !== null && isOlympusBibliotecaCatalogPage(targetTabUrl)
  const buttonLabel =
    catalogImportCompletedTarget && catalogImportProgress?.stage === 'done'
      ? t('popup.catalogImportOpenRecovered')
      : t('popup.catalogImportAction')
  const statusMessage = (() => {
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
      count,
      label: catalogImportSnapshot.listLabel,
    })
  })()
  const hintMessage = catalogImportSnapshot
    ? catalogImportProgress?.stage === 'done' && catalogImportProgress.summary
      ? t('popup.catalogImportDoneBreakdown', {
          created: catalogImportProgress.summary.created,
          moved: catalogImportProgress.summary.moved,
          reused: catalogImportProgress.summary.reused,
          omitted: catalogImportProgress.summary.omitted,
        })
      : duplicateList
        ? t('popup.catalogImportDuplicateWarning', {
            label: getLocalizedListDefinitionLabel(duplicateList, t),
          })
        : t('popup.catalogImportNameSuggestion')
    : null

  return {
    buttonLabel,
    canRun,
    completedTarget: catalogImportCompletedTarget,
    count,
    duplicateList,
    hintMessage,
    isOlympusCatalogPage,
    needsNewListName,
    previewItems,
    progress: catalogImportProgress,
    snapshot: catalogImportSnapshot,
    statusMessage,
    target: catalogImportTarget,
    actions: {
      changeMergeConfirmed: setCatalogImportMergeConfirmed,
      changeNewListLabel: setCatalogImportNewListLabel,
      changeTarget: setCatalogImportTarget,
      recoverCatalog: () => void recoverCatalog(),
      scanOlympusCatalog: () => void scanOlympusCatalog(),
    },
  }
}
