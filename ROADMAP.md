# Spectral Prism: Roadmap

Phases are capability gates, not dates. Each phase ends with a demonstrable artifact and a go/no-go review of the assumptions it tested. Gates cite REQUIREMENTS.md IDs; the annex is the single ledger of what each gate proves. Gate coverage: P0 gate proves SP-DP-001..008, SP-DP-010, SP-UX-001; P1 gate proves SP-DP-011 (ENVI), SP-DP-012..014, SP-RP-001/003/005/006, SP-CO-001..004, SP-XP-002..004, SP-UX-002..005/008; P2 gate proves SP-CP-001..011, SP-CO-005, SP-RP-002, SP-DP-009, SP-UX-006/007 (SP-UX-005 continues through P3); P3 gate proves SP-DP-011 (GeoTIFF/NetCDF), SP-RP-004, SP-XP-001/005/006/007. Parked at P4+: SP-XP-008/009, SP-RP-007.

## Phase 0: Substrate (data-plane core + proof)

- Monorepo scaffold (pnpm workspaces): `prism-core`, `spectral-prism`, `spectral-prism-py` (CLI). Verify the `sprism` entry-point name is free on PyPI, and run the broader name-collision scan (npm, PyPI, GitHub org, trademark; the "Prism" namespace is crowded: PRISM climate dataset, Prisma ORM, Prism.js) with `spectral-prism` as the intended namespace unless the scan surprises.
- Governance scaffold: LICENSE (Apache 2.0), NOTICE, CONTRIBUTING (DCO sign-off, conventional-commit package scopes, ADR process for design changes), CODE_OF_CONDUCT, SECURITY.md (no-telemetry statement, disclosure contact).
- prism-core Stage 1 extraction per ADR-0006 as amended: store abstraction (with pluggable request authorization), chunk cache/scheduler, GeoZarr convention reader, memory governor. Registry, probe/selection models, dual-LUT, and panel shell remain in their consumers until the Stage 2 extraction at the end of Phase 2.
- Data plane spike: zarrita FetchStore + icechunk-js reading an EMIT/AVIRIS-3 scene; GeoZarr convention reader; measure probe latency on spectral-major chunks against the 200 ms target.
- CLI v0: archival granule -> dual-layout GeoZarr (ADR-0003; pyramid optionally warped to a display CRS per ADR-0007) with ZEP0005-aligned per-chunk stats and multiscales; VirtualiZarr -> Icechunk reference path.
- Stand up the public demo mirror: a project-hosted, CORS-enabled bucket carrying CLI-converted EMIT and AVIRIS-3 scenes (the archives themselves are auth-gated; see GAP-ANALYSIS Section 5).
- **Gate:** probe latency and cold-open targets met against the mirror on the reference baseline; icechunk-js conformance fixtures green; the Q1 capability-tier table written and adopted.

## Phase 1: The Triad (view-only workbench)

- Spatial panel: deck.gl custom layer, wavelength-composite mode, multiscale pyramid consumption, dual-LUT on single components.
- Spectral panel: regl line/density renderer; probes (point + region), bad-band shading, wavelength cursors.
- Feature-space panel: regl-scatterplot over band-vs-band projections (no fit required yet).
- Coordination: Mosaic + DuckDB-WASM; probes/selections/library tables; linked brushing across all three panels at the 100 ms target.
- USGS spectral library integration and probe-to-match (SAM in SQL): the early adoption wedge.
- Local ENVI ingest via Blob.slice into the unified chunk abstraction (SP-DP-011 ENVI path): the P5 field-QA opening step; first-run surface incl. example gallery and drag-drop (SP-UX-008).
- **Gate:** the triad + brushing demo on a public EMIT scene, fully static-hosted; selection propagation under 100 ms at 1M points on the reference baseline.

## Phase 2: Fit/Apply (the analytical engine)

- WebGPU kernels: streaming covariance, MNF noise estimation; wasm fallback tier; CPU eigen-solve; basis objects with provenance.
- Apply-phase tile materialization per ADR-0004 as amended: derived product tile pipeline and cache (under the memory governor), asynchronous viewport fill with visible state; spatial panel derived-tile render mode; eigenvector-as-spectrum plotting; feature-space re-projection onto fitted axes.
- Strategies: PCA, MNF, SAM (GPU path for large libraries), RX, generalized nm-space band indices, continuum removal (an apply-phase transform per resolved Q3, with the per-probe CPU path in the spectral panel).
- Basis export/import as `.spb` bundles (zip-packed self-describing Zarr group; xarray-readable); determinism test (SPEC success criterion).
- prism-core Stage 2 extraction (ADR-0006): registry contract, probe/selection models, dual-LUT, panel shell, now that both consumers' shapes exist.
- **Gate:** viewport-scale MNF under 10 s on the reference baseline; first derived tiles within 2 s of fit completion; identical-apply reproducibility.

## Phase 3: Hardening and Reach

- Local file ingest completion: GeoTIFF and EMIT NetCDF into the unified chunk abstraction (ENVI landed in Phase 1 for the P5 journey).
- Air-gap deployment test; performance/memory budgets enforced (chunk cache pressure, bundle lazy-loading).
- Embeddable component packaging (MMGIS, OpenMCT mounts); PWA polish.
- Export surface: PNG composites, CSV/Parquet stats and spectra, selection masks as vectors, and the versioned `.sps` session document (file and shareable URL fragment).
- **Gate:** embedded demo inside MMGIS; offline demo; session round-trip across browsers.

## Phase 4+ (explicitly parked)

Unmixing and clustering strategies; supervised click-to-label; MCP Apps tool surface (Q6); optional server acceleration (xpublish-tiles low-zoom path); write-enabled Icechunk sessions; WebGPU render unification; two-store workflows; volume rendering (novelty).

## Standing Risks

| Risk | Tripwire | Response | Cadence |
|---|---|---|---|
| icechunk-js maturity (ADR-0002) | Conformance fixtures fail on upstream release; maintainer inactivity > 1 quarter | Pin; contribute fix upstream; plain-Zarr fallback (SP-DP-003) is always shippable | Per release |
| GeoZarr pre-1.0 churn (ADR-0001) | Convention namespace or schema change in SWG drafts | Version the convention reader; adapter for prior namespace | Monthly (SWG meeting) |
| WebGPU platform variance (ADR-0004, Q1) | Tier-A kernel failures on a target platform in CI | Demote platform to tier B; fallback is not optional scope | Per release |
| Numerical parity drift (ADR-0008) | Golden-scene cross-tier tolerance breach in CI | Investigate driver/kernel change; tolerance changes require ADR-0008 amendment, never a test edit | Continuous (CI) |
| Scope gravity from raster-prism parity requests | Feature request touching core without both consumers exhibiting the shape | Non-goals list is the defense; parity flows through prism-core Stage 2 or not at all | Per request |
