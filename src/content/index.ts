import { detectCurrentDocument } from '../shared/detection/registry'
import type { WatchLogMessage } from '../shared/messages'

let lastSignature = ''
let lastUrl = window.location.href
let timeoutId: number | undefined

function scheduleDetection(delay = 800): void {
  window.clearTimeout(timeoutId)
  timeoutId = window.setTimeout(() => {
    void reportDetection()
  }, delay)
}

async function reportDetection(): Promise<void> {
  const detection = detectCurrentDocument(document, window.location.href)
  if (!detection) {
    return
  }

  const signature = JSON.stringify([
    detection.title,
    detection.progressLabel,
    detection.url,
    detection.sourceSite,
  ])

  if (signature === lastSignature) {
    return
  }

  lastSignature = signature
  await chrome.runtime.sendMessage({
    type: 'watchlog/report-detection',
    payload: detection,
  })
}

chrome.runtime.onMessage.addListener((message: WatchLogMessage, _sender, sendResponse) => {
  if (message.type !== 'watchlog/request-live-detection') {
    return false
  }

  sendResponse({
    detection: detectCurrentDocument(document, window.location.href),
  })

  return false
})

const observer = new MutationObserver(() => {
  scheduleDetection()
})

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
})

window.addEventListener('load', () => {
  scheduleDetection(200)
})

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    scheduleDetection(200)
  }
})

window.setInterval(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href
    scheduleDetection(200)
  }
}, 1000)

scheduleDetection(200)
