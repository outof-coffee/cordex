import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 5000,
    include: ['src/**/*.test.ts', 'src/**/*.test.js']
  }
});
