import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

// https://crxjs.dev/vite-plugin
export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  build: {
    // pdfjs-dist is intentionally large (~1.2 MB) — suppress the expected warning.
    chunkSizeWarningLimit: 2000,
  },
})

