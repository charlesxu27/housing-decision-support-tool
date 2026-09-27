import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // MapLibre ships its own worker module; pre-bundling breaks its URL in Vite 8.
    exclude: ['maplibre-gl'],
  },
})
