/** Loads initial library data, keeps storage-driven refreshes in sync, and cleans URL bootstrap params. */
import { startTransition, useEffect, type Dispatch, type SetStateAction } from 'react'
import { getExplorer, getLibrary } from '../../shared/client'
import type { I18nValue } from '../../shared/i18n/context'
import type { MetadataCard, WatchLogSnapshot } from '../../shared/types'
import type { LibraryStatusMessageState } from '../types'

type UseLibraryBootstrapParams = {
  setExplorerItems: Dispatch<SetStateAction<MetadataCard[]>>
  setSnapshot: Dispatch<SetStateAction<WatchLogSnapshot>>
  setStatusMessageState: Dispatch<SetStateAction<LibraryStatusMessageState>>
  t: I18nValue['t']
}

export function useLibraryBootstrap({
  setExplorerItems,
  setSnapshot,
  setStatusMessageState,
  t,
}: UseLibraryBootstrapParams) {
  useEffect(() => {
    document.title = t('titles.library')
  }, [t])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.location.search) {
      return
    }

    const url = new URL(window.location.href)
    url.search = ''
    window.history.replaceState(null, '', url.toString())
  }, [])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [libraryResponse, explorerResponse] = await Promise.all([getLibrary(), getExplorer()])
        if (cancelled) return
        startTransition(() => {
          setSnapshot(libraryResponse.snapshot)
          setExplorerItems(explorerResponse.items)
          setStatusMessageState({ key: 'library.ready' })
        })
      } catch (error) {
        console.error('[WatchLog] library:bootstrap:error', error)
        if (cancelled) return
        setStatusMessageState({
          key: 'library.errorWithReason',
          params: { reason: error instanceof Error ? error.message : 'bootstrap-failed' },
        })
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [setExplorerItems, setSnapshot, setStatusMessageState])

  useEffect(() => {
    const handleStorageChange = async (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (
        areaName !== 'local' ||
        (!('watchlog.catalog' in changes) &&
          !('watchlog.activity' in changes) &&
          !('watchlog.lists' in changes))
      ) {
        return
      }

      try {
        const response = await getLibrary()
        startTransition(() => {
          setSnapshot(response.snapshot)
        })
      } catch (error) {
        console.error('[WatchLog] library:storage-refresh:error', error)
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange)
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [setSnapshot])
}
