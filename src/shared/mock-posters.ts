interface TemporaryPosterSpec {
  accentA: string
  accentB: string
  glow: string
  label: string
}

const TEMP_POSTER_SPECS: TemporaryPosterSpec[] = [
  { accentA: '#7c3aed', accentB: '#1d4ed8', glow: '#22d3ee', label: 'Quantum Run' },
  { accentA: '#be123c', accentB: '#7c2d12', glow: '#fb7185', label: 'Velvet Shadow' },
  { accentA: '#14532d', accentB: '#0f766e', glow: '#4ade80', label: 'Green Signal' },
  { accentA: '#1e1b4b', accentB: '#312e81', glow: '#a78bfa', label: 'Midnight Code' },
  { accentA: '#0f172a', accentB: '#1d4ed8', glow: '#60a5fa', label: 'Blue Horizon' },
  { accentA: '#3f3f46', accentB: '#18181b', glow: '#f59e0b', label: 'Ash Protocol' },
  { accentA: '#4c0519', accentB: '#9f1239', glow: '#fda4af', label: 'Scarlet Loop' },
  { accentA: '#052e16', accentB: '#166534', glow: '#86efac', label: 'Forest Drive' },
  { accentA: '#172554', accentB: '#1e3a8a', glow: '#93c5fd', label: 'Orbit Frame' },
  { accentA: '#111827', accentB: '#27272a', glow: '#c084fc', label: 'Void Chamber' },
] as const

function buildPosterDataUrl(spec: TemporaryPosterSpec, index: number): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="420" height="620" viewBox="0 0 420 620" fill="none">
      <desc>WatchLogTemporaryPoster</desc>
      <defs>
        <linearGradient id="bg" x1="44" y1="18" x2="390" y2="598" gradientUnits="userSpaceOnUse">
          <stop stop-color="${spec.accentA}" />
          <stop offset="1" stop-color="${spec.accentB}" />
        </linearGradient>
        <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(312 124) rotate(129) scale(226 182)">
          <stop stop-color="${spec.glow}" stop-opacity="0.95" />
          <stop offset="1" stop-color="${spec.glow}" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="420" height="620" rx="34" fill="url(#bg)" />
      <rect x="18" y="18" width="384" height="584" rx="26" fill="#05070E" fill-opacity="0.14" stroke="#FFFFFF" stroke-opacity="0.14" />
      <circle cx="316" cy="130" r="126" fill="url(#glow)" />
      <circle cx="94" cy="512" r="104" fill="#FFFFFF" fill-opacity="0.08" />
      <path d="M44 412C126 362 194 332 252 278C312 222 342 172 384 108" stroke="#FFFFFF" stroke-opacity="0.28" stroke-width="13" stroke-linecap="round" />
      <path d="M58 462C144 414 214 372 284 314C316 287 350 248 378 208" stroke="#FFFFFF" stroke-opacity="0.18" stroke-width="6" stroke-linecap="round" />
      <rect x="42" y="42" width="100" height="30" rx="15" fill="#0B1220" fill-opacity="0.52" stroke="#FFFFFF" stroke-opacity="0.14" />
      <text x="62" y="62" fill="#E7ECF8" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="700" letter-spacing="2">WATCHLOG</text>
      <text x="42" y="466" fill="#F8FAFC" font-family="Segoe UI, Arial, sans-serif" font-size="56" font-weight="800" letter-spacing="-2">${spec.label}</text>
      <text x="42" y="508" fill="#F8FAFC" fill-opacity="0.82" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="600">Temporary visual preview ${String(index + 1).padStart(2, '0')}</text>
      <text x="42" y="554" fill="#E2E8F0" fill-opacity="0.74" font-family="Segoe UI, Arial, sans-serif" font-size="16">Synthetic Horizon mock poster</text>
      <text x="346" y="566" fill="#FFFFFF" fill-opacity="0.18" font-family="Segoe UI, Arial, sans-serif" font-size="96" font-weight="800">${String(index + 1).padStart(2, '0')}</text>
    </svg>
  `

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const TEMP_POSTERS = TEMP_POSTER_SPECS.map(buildPosterDataUrl)

function hashSeed(seed: string): number {
  let hash = 0

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash)
}

export function getTemporaryPoster(seed: string): string {
  if (!seed.trim()) {
    return TEMP_POSTERS[0]
  }

  return TEMP_POSTERS[hashSeed(seed) % TEMP_POSTERS.length]
}

export function getRandomTemporaryPoster(): string {
  return TEMP_POSTERS[Math.floor(Math.random() * TEMP_POSTERS.length)]
}

export function hasTemporaryPoster(poster?: string): boolean {
  if (typeof poster !== 'string') {
    return false
  }

  return poster.startsWith('/mock-posters/') || poster.includes('WatchLogTemporaryPoster')
}
