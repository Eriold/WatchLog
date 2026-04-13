/** Keeps the popup synchronized with the persisted library snapshot and list storage. */
import { useEffect } from 'react'
import { getLibrary } from '../../shared/client'
import { STORAGE_KEYS } from '../../shared/constants'
import type { PopupStateModel } from './usePopupState'
import { buildPopupListOptions, mergePopupLists, readPopupLists } from '../utils/popup-helpers'

interface UsePopupLibrarySyncOptions {
  state: PopupStateModel
}

export function usePopupLibrarySync({ state }: UsePopupLibrarySyncOptions) {
  const { setLibraryHydrated, setListOptions, setMessageState, setSnapshot } = state

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
        if (!cancelled) {
          setListOptions(lists)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setListOptions(mergePopupLists([]))
        }
      })

    return () => {
      cancelled = true
    }
  }, [setLibraryHydrated, setListOptions, setMessageState, setSnapshot])

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
  }, [setLibraryHydrated, setListOptions, setSnapshot])
}
