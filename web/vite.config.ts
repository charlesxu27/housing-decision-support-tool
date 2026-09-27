import { copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const root = dirname(fileURLToPath(import.meta.url))

/**
 * MapLibre resolves its tile worker as a sibling of the bundled chunk
 * (`/assets/maplibre-gl-worker.mjs`). Vite hashes the library into a different
 * filename and does not emit that sibling, so production street tiles 404.
 * The worker imports `maplibre-gl-shared.mjs` from the same directory.
 */
function maplibreWorker(): Plugin {
  const files = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'] as const
  return {
    name: 'maplibre-worker',
    apply: 'build',
    closeBundle() {
      const from = resolve(root, 'node_modules/maplibre-gl/dist')
      const to = resolve(root, 'dist/assets')
      for (const file of files) {
        copyFileSync(resolve(from, file), resolve(to, file))
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), maplibreWorker()],
  optimizeDeps: {
    // MapLibre ships its own worker module; pre-bundling breaks its URL in Vite 8.
    exclude: ['maplibre-gl'],
  },
})
