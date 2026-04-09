export interface LibraryNavigationTarget {
  viewId: string | null
  catalogId: string | null
  query: string | null
}

const LIBRARY_VIEW_PARAM = 'view'
const LIBRARY_ENTRY_PARAM = 'entry'
const LIBRARY_QUERY_PARAM = 'query'

export function buildLibraryUrl(
  baseUrl: string,
  target?: Partial<LibraryNavigationTarget>,
): string {
  const url = new URL(baseUrl)

  if (target?.viewId) {
    url.searchParams.set(LIBRARY_VIEW_PARAM, target.viewId)
  }

  if (target?.catalogId) {
    url.searchParams.set(LIBRARY_ENTRY_PARAM, target.catalogId)
  }

  if (target?.query) {
    url.searchParams.set(LIBRARY_QUERY_PARAM, target.query)
  }

  return url.toString()
}

export function parseLibraryNavigationTarget(search: string): LibraryNavigationTarget {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)

  return {
    viewId: params.get(LIBRARY_VIEW_PARAM),
    catalogId: params.get(LIBRARY_ENTRY_PARAM),
    query: params.get(LIBRARY_QUERY_PARAM),
  }
}
