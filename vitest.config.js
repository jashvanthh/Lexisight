import { defineConfig } from 'vitest/config'

// Standalone Vitest config -- does NOT extend vite.config.js
// Vite config pulls in react(), VitePWA(), @tensorflow/tfjs etc. which
// are browser-only and break Node-based unit tests.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.{js,jsx,ts,tsx}'],
    exclude: ['node_modules', 'dist'],
    reporters: ['verbose'],
    // Do NOT load the project's vite.config.js -- it imports browser-only plugins
    // Use only what the tests themselves need (pure ESM utility functions)
  },
})
