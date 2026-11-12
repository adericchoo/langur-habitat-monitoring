import { defineConfig } from 'vitest/config'

// Pure-unit tests only (the compute Interval selectors). Node environment — no
// DOM — since the tested code is framework-free. Component tests, if ever added,
// would switch to a jsdom environment.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
