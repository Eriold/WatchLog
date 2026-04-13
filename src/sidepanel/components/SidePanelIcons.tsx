/** Contains SVG-only sidepanel icons so visual glyphs stay out of the main app container. */
import type { CatalogSyncVisualState, NavGlyphKind } from '../types'

export function SyncStatusGlyph({
  state,
  className,
}: {
  state: CatalogSyncVisualState
  className?: string
}) {
  if (state === 'synced') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
        <path d="m6.5 12.5 3.3 3.3 7.7-8.1" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      </svg>
    )
  }

  if (state === 'syncing') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={`${className ?? ''} is-spinning`.trim()}>
        <path d="M20 12a8 8 0 1 1-2.34-5.66" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        <path d="M20 4v4h-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
      <path d="M7 7 17 17M17 7 7 17" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  )
}

export function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
      <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.63l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.28 7.28 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42H10.1a.5.5 0 0 0-.5.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.85a.5.5 0 0 0 .12.63l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.63l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.41 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .5.42h3.8a.5.5 0 0 0 .5-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.63l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" />
    </svg>
  )
}

export function CloseIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
      <path d="M6 6 18 18M18 6 6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

export function NavGlyph({ kind, className }: { kind: NavGlyphKind; className?: string }) {
  if (kind === 'library') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
        <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4H19v14.5A1.5 1.5 0 0 0 17.5 17H7.5A2.5 2.5 0 0 0 5 19.5V6.5Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
        <path d="M7.5 4v13M9.5 8H16M9.5 11H16M9.5 14H13.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
      </svg>
    )
  }

  if (kind === 'watching') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path d="m10 8.8 5 3.2-5 3.2V8.8Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
      </svg>
    )
  }

  if (kind === 'completed') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path d="m8.5 12.3 2.4 2.4 4.8-5.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      </svg>
    )
  }

  if (kind === 'favorites') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
        <path d="M12 19.2 5.9 13.5A4.1 4.1 0 0 1 11.7 7.8L12 8.1l.3-.3a4.1 4.1 0 0 1 5.8 5.7L12 19.2Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.8 12h16.4M12 3.8c2.1 2.2 3.2 5 3.2 8.2S14.1 18 12 20.2C9.9 18 8.8 15.2 8.8 12S9.9 6 12 3.8Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  )
}
