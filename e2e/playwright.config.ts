import { defineConfig, devices } from '@playwright/test'
import { APP_ENV, WEB_PORT } from './support'

export default defineConfig({
  testDir: '.',
  outputDir: '../test-results',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  forbidOnly: true,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    baseURL: `http://localhost:${WEB_PORT}`,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node ../scripts/dev.mjs',
    url: `http://localhost:${WEB_PORT}`,
    env: APP_ENV,
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
  },
})
