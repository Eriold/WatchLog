/** Groups the popup SVG icons so visual sections can reuse them without inlining large SVG blocks. */
import type { ReactNode } from 'react'

interface IconProps {
  className?: string
}

function BaseIcon({
  className,
  children,
  viewBox = '0 0 24 24',
}: IconProps & { children: ReactNode; viewBox?: string }) {
  return (
    <svg aria-hidden="true" viewBox={viewBox} className={className}>
      {children}
    </svg>
  )
}

export function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <BaseIcon className={`heart-icon ${filled ? 'is-filled' : ''}`}>
      <path d="M12 21.35 10.55 20C5.4 15.24 2 12.09 2 8.24 2 5.09 4.42 2.75 7.44 2.75c1.71 0 3.35.81 4.56 2.09 1.21-1.28 2.85-2.09 4.56-2.09C19.58 2.75 22 5.09 22 8.24c0 3.85-3.4 7-8.55 11.76L12 21.35Z" />
    </BaseIcon>
  )
}

export function LaunchIcon() {
  return (
    <BaseIcon className="action-icon">
      <path
        d="M14 5h5v5m0-5-7 7M10 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </BaseIcon>
  )
}

export function OpenInNewIcon() {
  return (
    <BaseIcon className="action-icon open-library-icon">
      <path
        d="M14 5h5v5m0-5-8.25 8.25M19 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </BaseIcon>
  )
}

export function PlayIcon() {
  return (
    <BaseIcon className="play-icon">
      <path d="M8 6.5v11l9-5.5-9-5.5Z" fill="currentColor" />
    </BaseIcon>
  )
}

export function JumpToLibraryIcon() {
  return (
    <BaseIcon className="action-icon popup-title-jump-icon">
      <path
        d="M8 16 16 8M10 8h6v6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </BaseIcon>
  )
}

export function CheckIcon() {
  return (
    <BaseIcon className="action-icon popup-save-check-icon">
      <path
        d="m5.5 12.5 4.1 4.1L18.5 7.7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </BaseIcon>
  )
}

export function SyncStatusGlyph({
  synced,
  className,
}: {
  synced: boolean
  className?: string
}) {
  if (synced) {
    return (
      <BaseIcon className={className}>
        <path
          d="m6.5 12.5 3.3 3.3 7.7-8.1"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </BaseIcon>
    )
  }

  return (
    <BaseIcon className={className}>
      <path
        d="M7 7 17 17M17 7 7 17"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </BaseIcon>
  )
}
