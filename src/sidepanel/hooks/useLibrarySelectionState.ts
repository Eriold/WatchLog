/** Manages local sidepanel selection and filter state independently from data-loading hooks. */
import { useState } from 'react'
import { getInitialLibrarySelection } from '../utils/view-helpers'

export function useLibrarySelectionState() {
  const initialSelection = getInitialLibrarySelection()
  const [selectedViewId, setSelectedViewId] = useState(initialSelection.viewId)
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(initialSelection.catalogId)
  const [selectedExplorerId, setSelectedExplorerId] = useState<string | null>(null)
  const [selectedExplorerSaveListId, setSelectedExplorerSaveListId] = useState('')
  const [libraryQuery, setLibraryQuery] = useState(initialSelection.query)
  const [typeFilter, setTypeFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [sortBy, setSortBy] = useState('recent')
  const [explorerQuery, setExplorerQuery] = useState('')

  return {
    explorerQuery,
    libraryQuery,
    selectedCatalogId,
    selectedExplorerId,
    selectedExplorerSaveListId,
    selectedViewId,
    sortBy,
    sourceFilter,
    typeFilter,
    setExplorerQuery,
    setLibraryQuery,
    setSelectedCatalogId,
    setSelectedExplorerId,
    setSelectedExplorerSaveListId,
    setSelectedViewId,
    setSortBy,
    setSourceFilter,
    setTypeFilter,
  }
}
