import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// Dev server and build for the demo page. The demo imports the package by
// name so its code reads exactly like a consumer's.
export default defineConfig({
  root: 'demo',
  base: process.env.DEMO_BASE ?? '/',
  resolve: {
    alias: {
      'golf-shot-viz/react': fileURLToPath(new URL('./src/react/index.tsx', import.meta.url)),
      'golf-shot-viz/trackman': fileURLToPath(new URL('./src/trackman/index.ts', import.meta.url)),
      'golf-shot-viz': fileURLToPath(new URL('./src/index.ts', import.meta.url)),
    },
  },
  build: {
    outDir: '../dist-demo',
    emptyOutDir: true,
    // The demo ships three.js in one chunk on purpose.
    chunkSizeWarningLimit: 700,
  },
})
