import { defineConfig } from 'vitest/config';

// Unit tests across all workspace packages (pnpm test, part of pnpm verify).
// The parity suite runs separately via vitest.parity.config.ts (pnpm test:parity).
export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
