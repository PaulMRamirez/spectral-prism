# CLAUDE.md: Spectral Prism Project Reference

Browser-native analytical workbench for imaging spectroscopy. The spectrum is the primary object; the image is spatial context. Sibling of raster-prism; shared substrate in prism-core.

## Read First

- `SPEC.md`: vision, design principles, goals/non-goals, panel triad, strategy families, success criteria, open questions Q1-Q7.
- `ARCHITECTURE.md`: four planes (data, compute, render, coordination), memory governor, deployment/isolation postures, degradation matrix, library selections, canonical data-flow traces.
- `docs/adr/0001-0007`: format (Zarr v3 + GeoZarr), access (zarrita + icechunk-js), dual chunk layout with ZEP0005-aligned stats, compute-plane spectral math with derived-tile rendering, Mosaic + DuckDB-WASM, two-stage prism-core split, display projection model. Do not relitigate accepted ADRs in passing; propose a superseding ADR if evidence demands it.
- `docs/reviews/spec-review-v0.1.md`: the review whose findings produced v0.2; useful for the reasoning behind amendments.
- `docs/autonomy/AUTONOMY-PLAN.md`: the autonomous delivery loop. When running under a /goal, the Section 3 session protocol governs every iteration, Section 4 sets the /simplify and /security-review cadence, and Section 7 stop conditions override task completion: escalating is success, guessing is failure. STATE.md is the ledger; the design-reviewer and spec-auditor subagents plus the phase-gate skill are the checkers.
- `docs/design/DESIGN-BRIEF.md`: the design constitution; SP-UX requirements in REQUIREMENTS.md bind UI work to it.
- `GAP-ANALYSIS.md`, `ROADMAP.md`: positioning and phase gates.

## Non-Negotiable Design Invariants

1. Client-side is the architecture: no mandatory server component, ever. Air-gap deployment is a success criterion, not an afterthought.
2. Wavelength is a coordinate (nm), never a bare band index, at every API boundary above the chunk layer.
3. No invisible decisions: band masks, resampling, noise-estimation method, overview level, and stats provenance are surfaced in UI and recorded in artifacts.
4. Fit/apply separability: bases and reference spectra are durable, provenance-carrying objects.
5. The three-panel contract: analytical signal never hides raw data; the relationship between them is always visible.
6. Chunking is the scheduling primitive: new features must state their chunk access pattern.
7. The render plane never touches full spectral depth: all spectral math (fit and apply) lives in the compute plane and emits derived tiles; WebGL2 samples and ramps (ADR-0004 as amended).
8. Rasters are never warped in the browser: scene mode renders native CRS pixel-true; any display-CRS pyramid is warped once at ingest by the CLI (ADR-0007).
9. All memory pools live under the prism-core memory governor; no cache owns its own unbounded budget.
10. Feature-space sampling is deterministic, provenance-recorded, and visibly indicated; dtype scale/offset is applied in kernels and shaders, never by eager float32 materialization.

## Repository Conventions

- Monorepo, pnpm workspaces: `packages/prism-core`, `packages/spectral-prism`, `tools/spectral-prism-py`.
- License: Apache 2.0.
- Conventional commits with package scopes, for example `feat(core): chunk scheduler priority ring`, `fix(spectral): MNF boundary-pixel exclusion count`.
- Style: no em dashes anywhere (code comments, docs, UI strings); use commas, colons, parentheses, or semicolons.
- Design artifacts are living markdown specifications in-repo; decisions of consequence get ADRs in `docs/adr/` following the existing numbering.
- Review-loop protocol: reviews are versioned documents in `docs/reviews/`; findings are graded F-crit/F-major/F-minor and numbered continuously across reviews (next: F44); applying a review bumps the draft version; accepted ADRs change only by amendment or supersession recorded in the ADR itself.
- Requirements are ledgered in `REQUIREMENTS.md` with stable IDs (SP-DP/CP/RP/CO/XP-nnn); gates, tests, and commits cite IDs; IDs are never reused.
- TypeScript strict; React + Vite with ES module output (embeddable-component consumption pattern per LithoSphere/raster-prism precedent).

## Technical Quick Reference

- Zarr access: zarrita.js; Icechunk: icechunk-js (read-only, implements zarrita AsyncReadable; pin version, conformance fixtures in CI; plain-Zarr HTTP fallback must always work). Every store takes a pluggable request-authorization hook.
- Dual layout: spectral-major primary (bands x 64 x 64 class, native CRS, int16 + scale/offset default) + spatial-major multiscales pyramid (optionally ingest-warped to a display CRS); stats sidecar is ZEP0005-aligned; only binding/provenance metadata lives under `spectral_prism:`; produced by the CLI.
- Compute: WebGPU chunk-stream kernels (fit reductions and apply projections) with single-threaded wasm CPU fallback; apply emits derived product tiles into a governed cache; 224 x 224 solves on CPU (eigen, Cholesky). Every kernel: progress, cancellation, provenance.
- Render: WebGL2; deck.gl custom layer (spatial: wavelength composites of up to ~8 raw bands plus derived-tile ramping; scene mode default per ADR-0007), regl line/density (spectral), regl-scatterplot (feature space).
- Coordination: Mosaic selections over DuckDB-WASM (single-threaded MVP/EH bundle by default; threaded COI build only in the isolated posture per ARCHITECTURE 8.1); Parquet row groups aligned to spatial chunk boundaries; GPU highlight via selection-mask texture.
- Basis export: `.spb` bundle (zip-packed self-describing Zarr group: vectors, wavelength grid, band mask, provenance JSON).

## Testing Expectations

- Kernel parity tests per ADR-0008: wasm tier vs. WebGPU tier vs. NumPy/SciPy oracle fixtures; small synthetic cubes plus a committed real-AVIRIS golden scene with independently generated PCA/MNF/SAM reference outputs, tolerance-compared.
- Reproducibility: apply bitwise-deterministic within a tier for a given `.spb`; fit reproducible within a tier given the chunk stream; eigen sign/ordering conventions enforced.
- Snapshot tests for rendered tiles against synthetic cubes with known structure (edge cases: chunk boundaries, bad-band spans, nodata seams between concatenated flightlines, antimeridian when georeferenced).
- Store conformance: fixtures for Zarr v2, v3, sharded v3 (range-coalesced reads), Icechunk (native + virtual chunks), and degraded single-layout stores; abort-scope tests for viewport-epoch cancellation.
- No spectral decode, parse, or DuckDB work on the main thread (ARCHITECTURE 2.6); typed arrays cross workers only as transferables.

## Current Phase

Phase 0 (see ROADMAP.md): monorepo scaffold, prism-core Stage 1 extraction (data-plane core plus memory governor only; registry/probe/panel extraction waits for end of Phase 2), data-plane spike, CLI v0 for dual-layout materialization and virtualization, public demo mirror bucket, `sprism` PyPI name check. Gate metrics against the reference baseline (2024-class integrated-GPU laptop, 50 Mbps / 50 ms RTT): probe under 200 ms, cold open under 5 s, capability-tier table adopted.
