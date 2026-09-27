import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const blockGroupWhere =
  "STATE='42' AND COUNTY='003' AND TRACT IN ('130700','141200','140400','111500','120900','560400','564800','561400','515200','562300')"
const blockGroupQuery = new URLSearchParams({
  where: blockGroupWhere,
  outFields: 'GEOID,TRACT,BLKGRP,BASENAME',
  returnGeometry: 'true',
  outSR: '4326',
  f: 'geojson',
}).toString()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // MapLibre ships its own worker module; pre-bundling breaks its URL in Vite 8.
    exclude: ['maplibre-gl'],
  },
  server: {
    // WPRDC does not advertise browser CORS headers on this download.
    // Proxy it in local development; the production data pipeline will
    // snapshot the same authoritative geometry into a versioned static file.
    proxy: {
      '/wprdc-neighborhoods.geojson': {
        target: 'https://data.wprdc.org',
        changeOrigin: true,
        rewrite: () =>
          '/dataset/e672f13d-71c4-4a66-8f38-710e75ed80a4/resource/4af8e160-57e9-4ebf-a501-76ca1b42fc99/download/neighborhoods.geojson',
      },
      '/census-block-groups.geojson': {
        target: 'https://tigerweb.geo.census.gov',
        changeOrigin: true,
        rewrite: () =>
          `/arcgis/rest/services/Census2020/Tracts_Blocks/MapServer/1/query?${blockGroupQuery}`,
      },
    },
  },
})
