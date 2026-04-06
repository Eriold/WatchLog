export async function storageGet<T>(
  area: chrome.storage.StorageArea,
  key: string,
  fallback: T,
): Promise<T> {
  const result = await area.get(key)
  return (result[key] as T | undefined) ?? fallback
}

export async function storageSet<T>(
  area: chrome.storage.StorageArea,
  key: string,
  value: T,
): Promise<void> {
  await area.set({ [key]: value })
}

export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  let tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  if (tabs.length === 0) {
    tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  }

  return tabs[0] ?? null
}

export async function sendRuntimeMessage<TResponse>(message: unknown): Promise<TResponse> {
  console.log('[WatchLog] runtime:send', message)
  const response = await chrome.runtime.sendMessage(message)
  console.log('[WatchLog] runtime:response', {
    message,
    response,
  })

  if (
    response &&
    typeof response === 'object' &&
    'error' in response &&
    typeof response.error === 'string'
  ) {
    console.error('[WatchLog] runtime:error-response', {
      message,
      response,
    })
    throw new Error(response.error)
  }

  return response as TResponse
}
