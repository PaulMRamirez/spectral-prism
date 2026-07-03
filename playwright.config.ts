import { defineConfig } from '@playwright/test';

// pnpm e2e serves the built app (vite preview), so run pnpm build:web first;
// CI's verify step guarantees dist exists before the e2e step. WebGPU-flagged
// Chromium projects join in Phase 2 for tier-A kernel tests (ADR-0008); the
// wasm tier runs headless everywhere and is the parity anchor.
export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
  },
  webServer: {
    command: 'pnpm --filter spectral-prism preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
});
