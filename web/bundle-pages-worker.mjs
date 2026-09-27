import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const root = dirname(fileURLToPath(import.meta.url))

await build({
  configFile: false,
  root,
  publicDir: false,
  logLevel: 'warn',
  build: {
    emptyOutDir: false,
    outDir: resolve(root, 'dist'),
    lib: {
      entry: resolve(root, 'pages-worker.ts'),
      formats: ['es'],
      fileName: () => '_worker.js',
    },
    minify: true,
    cssCodeSplit: false,
  },
})
