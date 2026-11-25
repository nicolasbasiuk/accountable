import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

const env = process.env

/** Vite opens files in this computer's editor for any site that asks. This answers first. */
const noEditor: Plugin = {
  name: 'no-editor',
  configureServer({ middlewares }) {
    middlewares.use('/__open-in-editor', (_request, response) => {
      response.statusCode = 404
      response.end()
    })
  },
}

export default defineConfig({
  plugins: [noEditor, react(), tailwindcss()],
  cacheDir: env.ACCOUNTABLE_VITE_CACHE || undefined,
  server: {
    host: '127.0.0.1',
    port: Number(env.ACCOUNTABLE_WEB_PORT ?? 5173),
    strictPort: true,
    cors: false, // Vite would let any site on this computer read and change the data.
    proxy: { '/api': `http://127.0.0.1:${env.ACCOUNTABLE_API_PORT ?? 8000}` },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/testSetup.ts',
    allowOnly: false, // A stray it.only would hide the other tests in its file.
  },
})
