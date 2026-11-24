import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const env = process.env

export default defineConfig({
  plugins: [react(), tailwindcss()],
  cacheDir: env.ACCOUNTABLE_VITE_CACHE || undefined,
  server: {
    host: '127.0.0.1',
    port: Number(env.ACCOUNTABLE_WEB_PORT ?? 5173),
    strictPort: true,
    proxy: { '/api': `http://127.0.0.1:${env.ACCOUNTABLE_API_PORT ?? 8000}` },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/testSetup.ts',
    allowOnly: false, // A stray it.only would hide the other tests in its file.
  },
})
