import { test, expect } from '@playwright/test'

/**
 * LexiSight E2E smoke tests
 *
 * What a green result guarantees:
 *   - Vite serves the app without crashing
 *   - The landing page HTML is delivered by the server
 *   - React mounts into #root (page is not blank)
 *   - The /translate route resolves without a server error
 *   - No uncaught JavaScript errors on the landing page
 *     (Clerk/Convex warnings are ignored -- they use stub keys in CI)
 *
 * Strategy: use waitUntil:'domcontentloaded' so goto() returns as soon as
 * the HTML is parsed. The default 'load' waits for Clerk/Convex network
 * requests that never settle in CI, causing 60-second timeouts.
 */

/** Errors from Clerk/Convex stub keys are expected in CI -- ignore them. */
function isIgnorableError(msg) {
  return (
    msg.includes('Clerk') ||
    msg.includes('clerkjs') ||
    msg.includes('publishable') ||
    msg.includes('Convex') ||
    msg.includes('convex') ||
    msg.includes('WebSocket') ||
    msg.includes('placeholder')
  )
}

test.describe('Landing page', () => {
  test('serves HTML and mounts React', async ({ page }) => {
    const errors = []
    page.on('pageerror', err => {
      if (!isIgnorableError(err.message)) errors.push(err.message)
    })

    // domcontentloaded: returns as soon as HTML is parsed,
    // before Clerk/Convex scripts finish loading
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    // #root exists and React has injected something into it
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 30_000 })

    // Page title contains the app name (set in index.html <title>)
    await expect(page).toHaveTitle(/LexiSight/i, { timeout: 10_000 })

    expect(errors, `JS errors: ${errors.join(' | ')}`).toHaveLength(0)
  })

  test('shows a visible heading after React hydrates', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    // Wait up to 30s for React to render past the SplashScreen (800ms delay)
    const heading = page.locator('h1, h2').first()
    await expect(heading).toBeVisible({ timeout: 30_000 })
  })

  test('has a link to the translator', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    // Must have a heading first (React is hydrated)
    await page.locator('h1, h2').first().waitFor({ state: 'visible', timeout: 30_000 })

    const link = page.locator('a[href*="translat"]').first()
    await expect(link).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Translator route', () => {
  test('resolves without a server error', async ({ page }) => {
    const errors = []
    page.on('pageerror', err => {
      if (!isIgnorableError(err.message)) errors.push(err.message)
    })

    // Clerk may redirect to /sign-in -- that is fine, routing is working
    await page.goto('/translate', { waitUntil: 'domcontentloaded' })

    // Must render something into #root (not a blank screen or 404)
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 30_000 })

    expect(errors, `JS errors on /translate: ${errors.join(' | ')}`).toHaveLength(0)
  })
})
