import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E smoke tests for LexiSight.
 *
 * These tests verify that the app boots, routes resolve, and the UI
 * renders without JavaScript crashes. They do NOT test gesture recognition
 * (that is covered by the model regression test in scripts/).
 *
 * The dev server is started automatically by Playwright's webServer option.
 * VITE_CLERK_PUBLISHABLE_KEY and VITE_CONVEX_URL are passed via CI secrets.
 * Stub fallbacks are provided so the app doesn't throw on startup if the
 * secrets are missing (e.g. fork PRs with no access to secrets).
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

  webServer: {
    command: 'npx vite --port 5174',
    // Explicitly pass VITE_ env vars to the Vite subprocess.
    // process.env here is evaluated at config-parse time in the Playwright
    // Node process, which inherits the CI step environment (GitHub Secrets).
    // Stub fallbacks prevent main.jsx from throwing when secrets are absent.
    env: {
      ...process.env,
      VITE_CLERK_PUBLISHABLE_KEY:
        process.env.VITE_CLERK_PUBLISHABLE_KEY ||
        'pk_test_placeholder00000000000000000000000000000000',
      VITE_CONVEX_URL:
        process.env.VITE_CONVEX_URL || 'https://placeholder.convex.cloud',
    },
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
