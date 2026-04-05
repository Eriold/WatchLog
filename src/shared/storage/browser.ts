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
  return chrome.runtime.sendMessage(message) as Promise<TResponse>
}
