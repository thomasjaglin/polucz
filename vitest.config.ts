import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // jsdom for localStorage: storage.ts and reviewStorage.ts talk to it
    // directly, and stubbing it would test the stub rather than the code.
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
