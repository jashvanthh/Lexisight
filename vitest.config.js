import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.{js,jsx,ts,tsx}'],
    exclude: ['node_modules', 'dist'],
    reporters: ['verbose'],
    outputFile: {
      junit: 'test-results/junit.xml',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/utils/**', 'src/hooks/**'],
    },
  },
})

