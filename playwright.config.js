import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E smoke tests for LexiSight.
 *
 * In CI, Vite is started manually by the workflow (before npx playwright test)
 * so that environment variables (Clerk key, Convex URL) are passed correctly.
 * Playwright reuses that already-running server.
 *
 * Locally, Playwright auto-starts Vite via webServer (reads .env automatically).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: 'http://localhost:5174',
    navigationTimeout: 30_000,
    actionTimeout: 20_000,
    trace: 'on-first-retry',
    launchOptions: {
      args: [
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
      ],
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // In CI the workflow starts Vite before calling playwright test,
  // so we always reuse the existing server. Locally, auto-start it.
  webServer: {
    command: 'npx vite --port 5174',
    url: 'http://localhost:5174',
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
