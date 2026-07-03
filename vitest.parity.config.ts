import { defineConfig } from 'vitest/config';

// Kernel parity suite (pnpm test:parity): wasm tier vs. WebGPU tier vs.
// NumPy/SciPy oracle fixtures per ADR-0008. Kept out of pnpm verify so the
// verify gate stays fast; CI runs it as its own step.
export default defineConfig({
  test: {
    include: ['packages/*/parity/**/*.parity.test.ts'],
    environment: 'node',
  },
});
