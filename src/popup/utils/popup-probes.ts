/** Encapsulates popup tab probes so browser scripting and import detection stay outside the main popup hook. */
import type { CatalogImportSnapshot } from '../../shared/catalog-import/types'
import { extractOlympusBibliotecaCatalogSnapshot } from '../../shared/catalog-import/olympusbiblioteca'
import { extractZonaTmoCatalogSnapshot } from '../../shared/catalog-import/zonatmo'
import {
  buildDetectionFromScriptedSnapshot,
  SCRIPTED_TEXT_TITLE_SELECTORS,
  type ScriptedDetectionSnapshot,
} from '../../shared/detection/scripted-snapshot'
import type { DetectionResult } from '../../shared/types'
import type { DetectionDebugInfo } from '../../shared/messages'
import type { PopupPosterCandidate } from '../popup-types'

export async function runPopupScriptedDetection(tabId: number): Promise<{
  detection: DetectionResult | null
  debug: DetectionDebugInfo
}> {
  try {
    const tab = await chrome.tabs.get(tabId).catch(() => null)
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      args: [SCRIPTED_TEXT_TITLE_SELECTORS],
      func: (textTitleSelectors) => {
        const playerResponseTitle =
          (window as typeof window & {
            ytInitialPlayerResponse?: {
              videoDetails?: {
                title?: string
              }
            }
          }).ytInitialPlayerResponse?.videoDetails?.title ?? null
        const compact = (value: string) => value.replace(/\s+/g, ' ').trim()
        const getMeta = (property: string) =>
          document
            .querySelector(`meta[property="${property}"], meta[name="${property}"]`)
            ?.getAttribute('content')
            ?.trim() ?? null
        const getText = (selector: string) => {
          const text = document.querySelector(selector)?.textContent?.trim()
          return text ? compact(text) : null
        }
        const titleCandidates: string[] = []
        const seenTitles = new Set<string>()
        const faviconCandidates = Array.from(document.querySelectorAll('link[rel]'))
          .map((link) => ({
            href: link.getAttribute('href')?.trim() ?? '',
            rel: link.getAttribute('rel')?.trim() ?? '',
            type: link.getAttribute('type')?.trim() ?? null,
            sizes: link.getAttribute('sizes')?.trim() ?? null,
          }))
          .filter((candidate) => {
            if (!candidate.href) {
              return false
            }

            const rel = candidate.rel.toLowerCase()
            return (
              rel.includes('icon') ||
              rel.includes('apple-touch-icon') ||
              rel.includes('mask-icon')
            )
          })

        for (const selector of textTitleSelectors) {
          const text = getText(selector)
          if (text && !seenTitles.has(text)) {
            seenTitles.add(text)
            titleCandidates.push(text)
          }
        }

        return {
          href: window.location.href,
          pageTitle: document.title,
          bodyText: compact(document.body?.innerText ?? '').slice(0, 8000),
          faviconCandidates,
          titleCandidates,
          playerResponseTitle: playerResponseTitle ? compact(playerResponseTitle) : null,
          ogTitle: getMeta('og:title'),
          metaTitle: getMeta('title'),
          itempropName:
            document.querySelector('meta[itemprop="name"]')?.getAttribute('content')?.trim() ??
            null,
        }
      },
    })

    const snapshot = (result?.result as ScriptedDetectionSnapshot | undefined) ?? null
    const detection = snapshot
      ? buildDetectionFromScriptedSnapshot(snapshot, tab?.favIconUrl ?? null)
      : null

    return {
      detection,
      debug: {
        tabId,
        tabUrl: snapshot?.href ?? null,
        source: detection ? 'popup-scripting' : 'none',
        reason: detection ? undefined : 'popup-scripted-detection-returned-null',
      },
    }
  } catch {
    return {
      detection: null,
      debug: {
        tabId,
        tabUrl: null,
        source: 'none',
        reason: 'popup-scripted-detection-failed',
      },
    }
  }
}

export async function runPopupPosterProbe(tabId: number): Promise<PopupPosterCandidate[]> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const normalizeUrl = (rawValue: string | null | undefined) => {
          const raw = rawValue?.trim()
          if (!raw) {
            return null
          }

          try {
            const url = new URL(raw, window.location.href).toString()
            return /^https?:/i.test(url) ? url : null
          } catch {
            return null
          }
        }

        const scoreCandidate = (candidate: {
          url: string
          label: string
          source: 'meta' | 'page'
          width?: number
          height?: number
          top?: number
        }) => {
          let score = candidate.source === 'meta' ? 28 : 10
          const ratio =
            candidate.width && candidate.height ? candidate.width / candidate.height : undefined

          if (ratio !== undefined) {
            if (ratio >= 0.55 && ratio <= 0.82) {
              score += 48
            } else if (ratio > 0.82 && ratio <= 1.05) {
              score += 28
            } else if (ratio > 1.05 && ratio <= 1.9) {
              score += 12
            } else {
              score -= 6
            }
          }

          if (candidate.height) {
            if (candidate.height >= 600) {
              score += 16
            } else if (candidate.height >= 320) {
              score += 8
            }
          }

          if (candidate.width && candidate.height && candidate.width * candidate.height >= 250000) {
            score += 10
          }

          if (candidate.top !== undefined) {
            score += Math.max(0, 12 - Math.min(12, Math.abs(candidate.top) / 100))
          }

          const hintText = `${candidate.url} ${candidate.label}`.toLowerCase()
          if (/\b(?:cover|poster|volume|book|manga|novel|key visual|art)\b/.test(hintText)) {
            score += 18
          }

          if (/\b(?:avatar|icon|logo|emoji|sprite|banner|ads?)\b/.test(hintText)) {
            score -= 36
          }

          return score
        }

        const deduped = new Map<
          string,
          {
            url: string
            label: string
            source: 'meta' | 'page'
            width?: number
            height?: number
            score: number
          }
        >()

        const pushCandidate = (candidate: {
          url?: string | null
          label: string
          source: 'meta' | 'page'
          width?: number
          height?: number
          top?: number
        }) => {
          const url = normalizeUrl(candidate.url)
          if (!url) {
            return
          }

          if (
            candidate.width !== undefined &&
            candidate.height !== undefined &&
            (candidate.width < 120 || candidate.height < 120)
          ) {
            return
          }

          const score = scoreCandidate({
            url,
            label: candidate.label,
            source: candidate.source,
            width: candidate.width,
            height: candidate.height,
            top: candidate.top,
          })

          const existing = deduped.get(url)
          if (!existing || score > existing.score) {
            deduped.set(url, {
              url,
              label: candidate.label,
              source: candidate.source,
              width: candidate.width,
              height: candidate.height,
              score,
            })
          }
        }

        const getMeta = (property: string) =>
          document
            .querySelector(`meta[property="${property}"], meta[name="${property}"]`)
            ?.getAttribute('content')
            ?.trim() ?? null

        const ogWidth = Number.parseInt(getMeta('og:image:width') ?? '', 10)
        const ogHeight = Number.parseInt(getMeta('og:image:height') ?? '', 10)

        pushCandidate({
          url: getMeta('og:image'),
          label: 'OG image',
          source: 'meta',
          width: Number.isFinite(ogWidth) ? ogWidth : undefined,
          height: Number.isFinite(ogHeight) ? ogHeight : undefined,
        })
        pushCandidate({
          url: getMeta('twitter:image'),
          label: 'Twitter image',
          source: 'meta',
        })
        pushCandidate({
          url: getMeta('twitter:image:src'),
          label: 'Twitter image',
          source: 'meta',
        })
        pushCandidate({
          url:
            document.querySelector('meta[itemprop="image"]')?.getAttribute('content')?.trim() ??
            null,
          label: 'Item image',
          source: 'meta',
        })
        pushCandidate({
          url:
            document.querySelector('link[rel="image_src"]')?.getAttribute('href')?.trim() ?? null,
          label: 'Linked image',
          source: 'meta',
        })

        for (const image of Array.from(document.images)) {
          const url = image.currentSrc || image.src
          if (!url) {
            continue
          }

          const alt = image.getAttribute('alt')?.trim() ?? ''
          const className = image.getAttribute('class')?.trim() ?? ''
          const rect = image.getBoundingClientRect()

          pushCandidate({
            url,
            label: alt || className || 'Page image',
            source: 'page',
            width: image.naturalWidth || rect.width || undefined,
            height: image.naturalHeight || rect.height || undefined,
            top: Number.isFinite(rect.top) ? rect.top : undefined,
          })
        }

        return Array.from(deduped.values())
          .sort((left, right) => {
            if (right.score !== left.score) {
              return right.score - left.score
            }

            return (right.height ?? 0) - (left.height ?? 0)
          })
          .slice(0, 3)
      },
    })

    return (result?.result as PopupPosterCandidate[] | undefined) ?? []
  } catch {
    return []
  }
}

export async function runZonaTmoCatalogProbe(tabId: number): Promise<CatalogImportSnapshot | null> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractZonaTmoCatalogSnapshot,
    })

    return (result?.result as CatalogImportSnapshot | null | undefined) ?? null
  } catch {
    return null
  }
}

export async function runOlympusBibliotecaCatalogProbe(
  tabId: number,
): Promise<CatalogImportSnapshot | null> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractOlympusBibliotecaCatalogSnapshot,
    })

    return (result?.result as CatalogImportSnapshot | null | undefined) ?? null
  } catch {
    return null
  }
}
