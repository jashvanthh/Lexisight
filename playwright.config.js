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
 */
export default defineConfig({
  testDir: './e2e',
  // Maximum time one test can take
  timeout: 60_000,
  // Fail the build on CI if any test is accidentally left as .only
  forbidOnly: !!process.env.CI,
  // One retry on CI for transient flakiness
  retries: process.env.CI ? 1 : 0,
  // One worker in CI to avoid port conflicts
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: 'http://localhost:5174',
    navigationTimeout: 30_000,
    actionTimeout: 20_000,
    // Collect traces on failure
    trace: 'on-first-retry',
    // Fake camera so MediaPipe doesn't block on a real device
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
    // Pass the env vars Vite needs to avoid throwing on startup.
    // These are set in the CI job from GitHub Secrets, or in .env locally.
    command: 'npx vite --port 5174',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
