import { test, expect } from '@playwright/test'

/**
 * LexiSight E2E smoke tests
 *
 * These tests verify the app boots and core pages are reachable.
 * They do NOT test gesture recognition -- that is the model regression test.
 *
 * What a green result guarantees:
 *   - Vite serves the app without crashing
 *   - The landing page HTML renders (React hydrates)
 *   - Navigation links to /translate are present
 *   - The /translate route resolves to a page (even if behind auth)
 *   - No uncaught JavaScript errors on the landing page
 *
 * Strategy: use waitUntil:'domcontentloaded' so goto() returns once the HTML
 * is parsed. The default 'load' waits for Clerk + Convex network requests that
 * never settle on CI (no real backend), which causes 30-second timeouts.
 */

test.describe('Landing page', () => {
  test('loads without a JavaScript crash', async ({ page }) => {
    const errors = []
    // Ignore Clerk/Convex warnings -- expected in smoke test environment
    page.on('pageerror', err => {
      const msg = err.message
      if (
        !msg.includes('Clerk') &&
        !msg.includes('publishable') &&
        !msg.includes('clerkjs') &&
        !msg.includes('convex') &&
        !msg.includes('Convex')
      ) {
        errors.push(msg)
      }
    })

    // domcontentloaded fires once HTML is parsed -- does not wait for
    // Clerk CDN scripts or Convex WebSocket to settle
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 })

    // Wait for React to inject something into #root
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 30_000 })

    // Title contains app name
    await expect(page).toHaveTitle(/LexiSight/i, { timeout: 15_000 })

    // No unexpected crashes
    expect(errors, `Unexpected JS errors: ${errors.join(', ')}`).toHaveLength(0)
  })

  test('shows a visible heading', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 })

    // Wait for React to hydrate -- heading appears after SplashScreen clears
    const heading = page.locator('h1, h2').first()
    await expect(heading).toBeVisible({ timeout: 30_000 })
  })

  test('has a link to the translator', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 })

    // Wait for React to hydrate
    await page.locator('h1, h2').first().waitFor({ state: 'visible', timeout: 30_000 })

    // At least one anchor pointing at /translate (or /translator)
    const translatorLink = page.locator('a[href*="translat"]').first()
    await expect(translatorLink).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Translator route', () => {
  test('resolves to a page (auth wall or translator UI)', async ({ page }) => {
    const errors = []
    page.on('pageerror', err => {
      const msg = err.message
      if (
        !msg.includes('Clerk') &&
        !msg.includes('publishable') &&
        !msg.includes('clerkjs') &&
        !msg.includes('convex') &&
        !msg.includes('Convex')
      ) {
        errors.push(msg)
      }
    })

    // Clerk may redirect to /sign-in -- that is fine, routing is working
    await page.goto('/translate', { waitUntil: 'domcontentloaded', timeout: 30_000 })

    // Page must render something into #root (not a blank white screen or 404)
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 30_000 })

    // No uncaught JS crashes (missing model files, bad imports, etc.)
    expect(errors, `JS errors on /translate: ${errors.join(', ')}`).toHaveLength(0)
  })
})
