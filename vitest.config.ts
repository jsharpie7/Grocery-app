import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Mirrors the define in vite.config.ts. Without it, any test that reaches code referencing
  // __BUILD_ID__ fails with a bare ReferenceError rather than a useful assertion.
  define: {
    __BUILD_ID__: JSON.stringify('test'),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
})
