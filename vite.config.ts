import { crx } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { createManifest, type BuildTarget } from './manifest.config'

function getBuildTarget(): BuildTarget {
  return process.env.WATCHLOG_BROWSER === 'firefox' ? 'firefox' : 'chrome'
}

export default defineConfig(() => {
  const target = getBuildTarget()
  const rollupInput =
    target === 'firefox'
      ? {
          library: 'library.html',
          popup: 'popup.html',
          options: 'options.html',
        }
      : undefined

  return {
    plugins: [react(), crx({ manifest: createManifest(target) })],
    build: {
      outDir: target === 'firefox' ? 'dist-firefox' : 'dist',
      rollupOptions: rollupInput ? { input: rollupInput } : undefined,
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      coverage: {
        reporter: ['text', 'html'],
      },
    },
  }
})
