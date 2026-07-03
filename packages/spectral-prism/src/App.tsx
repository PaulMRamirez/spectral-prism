import { PRISM_CORE_STAGE } from 'prism-core';

// Placeholder shell: proves the deploy pipeline (Pages, base path, bundle
// budget) ahead of the Phase 0 data-plane work. The panel triad replaces this
// in Phase 1; until then the surface stays a quiet status readout, styled
// within the DESIGN-BRIEF token discipline.
export function App() {
  return (
    <main className="shell">
      <h1 className="shell-title">Spectral Prism</h1>
      <p className="shell-positioning">
        A browser-native analytical workbench for imaging spectroscopy: the spectrum is the primary
        object, the image is spatial context.
      </p>
      <p className="shell-status" data-testid="phase-status">
        phase 0: substrate / prism-core stage {PRISM_CORE_STAGE} pending
      </p>
    </main>
  );
}
