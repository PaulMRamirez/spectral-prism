import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Local dev, the verification gate, and embedded MMGIS/OpenMCT mounts use '/';
// the GitHub Pages project-page build sets SPECTRAL_PRISM_BASE=/spectral-prism/
// (pnpm build:pages), matching deploy.yml.
export default defineConfig({
  base: process.env.SPECTRAL_PRISM_BASE ?? '/',
  plugins: [react()],
});
