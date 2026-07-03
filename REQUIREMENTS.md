# Spectral Prism: Requirements Traceability Annex

**Status:** v0.4 baseline, 2026-07-01. SPEC.md is the narrative; this annex is the ledger. Each requirement carries a stable ID, priority, a testable acceptance criterion, its verifying test class (CLAUDE.md Testing Expectations), and the phase gate that proves it. Numbers are stated against the reference baseline defined in SPEC Section 9. IDs are never reused; withdrawn requirements are struck, not deleted.

## Data Plane (SP-DP)

| ID | P | Requirement | Acceptance | Verification | Gate |
|---|---|---|---|---|---|
| SP-DP-001 | P0 | Read Zarr v2/v3 (incl. sharded v3) over HTTP | Conformance fixtures pass; sharded reads use coalesced ranges | Store conformance | P0 |
| SP-DP-002 | P0 | Read Icechunk repos read-only, incl. virtual chunks, branch/tag/snapshot pinned | Icechunk fixtures (native + virtual) pass; snapshot id recorded in provenance | Store conformance | P0 |
| SP-DP-003 | P0 | Plain-Zarr HTTP fallback always functional independent of icechunk-js | Fallback suite green with icechunk-js absent | Store conformance | P0 |
| SP-DP-004 | P0 | GeoZarr convention reader (proj:, spatial:, multiscales, CF wavelength/FWHM/bad-band), versioned, degrading per matrix | Degradation matrix rows exercised as tests | Store conformance | P0 |
| SP-DP-005 | P0 | Dual-layout binding incl. per-layout CRS; degraded single-layout behavior | Binding metadata round-trips CLI -> browser; degraded warnings shown | Store conformance | P0 |
| SP-DP-006 | P0 | ZEP0005-aligned per-chunk stats consumed; on-the-fly fallback when absent | Skip-index honored; absent-stats path computes and warns | Store conformance | P0 |
| SP-DP-007 | P0 | Probe-to-spectrum under 200 ms on spectral-major layouts | Measured on demo mirror | Perf harness | P0 |
| SP-DP-008 | P0 | Cold open to composite under 5 s | Measured on demo mirror | Perf harness | P0 |
| SP-DP-009 | P0 | Dtype fidelity: scale/offset in kernels/shaders, nodata defined once and respected | Golden-scene int16 path bit-compares to float32 path within tolerance | Kernel parity | P2 |
| SP-DP-010 | P0 | Pluggable request authorization on every store | Header/token/URL-rewrite hooks exercised against an auth fixture | Store conformance | P0 |
| SP-DP-011 | P0 | Local file ingest via Blob.slice range reads: ENVI first (P5 opening journey step), GeoTIFF and EMIT NetCDF following | ENVI line opens cold to first composite within the 5 s target; multi-GB fixture opens without whole-file read | Store conformance + perf harness | P1 (ENVI); P3 (GeoTIFF/NetCDF) |
| SP-DP-012 | P0 | Worker topology per ARCH 2.6: no decode/parse/DuckDB on main thread; transferables only | Main-thread audit test; long-task budget in perf harness | Topology audit | P1 |
| SP-DP-013 | P0 | Request mechanics: per-origin budget, shard coalescing, epoch aborts, backoff taxonomy | Abort-scope and coalescing tests; stale-fetch count zero after pan storm | Store conformance | P1 |
| SP-DP-014 | P0 | Memory governor over all pools with visible readout | Pressure test evicts cross-pool; fit refuses over staging budget | Topology audit | P1 |

## Compute Plane (SP-CP)

| ID | P | Requirement | Acceptance | Verification | Gate |
|---|---|---|---|---|---|
| SP-CP-001 | P0 | PCA and MNF streaming fits per ADR-0008 numerical policy | Oracle tolerance on golden scene; co-moment partials + f64 merge audited | Kernel parity | P2 |
| SP-CP-002 | P0 | MNF noise estimation excludes chunk-boundary pixels, counted in provenance | Boundary-exclusion count matches oracle | Kernel parity | P2 |
| SP-CP-003 | P0 | Viewport-scale fit (512x512x224) under 10 s (tier A), progress + cancel | Perf harness; cancel leaves no orphaned buffers | Perf harness | P2 |
| SP-CP-004 | P0 | Apply materializes derived tiles + per-tile stats; first viewport tiles within 2 s of fit | Perf harness on golden scene | Perf harness | P2 |
| SP-CP-005 | P0 | wasm fallback tier: identical accumulation tree, tolerance-bounded parity | Cross-tier parity suite | Kernel parity | P2 |
| SP-CP-006 | P0 | Reproducibility: apply bitwise within tier; fit reproducible within tier; eigen sign/order conventions | Repeat-run suite | Kernel parity | P2 |
| SP-CP-007 | P0 | SAM/RX with condition-number surfacing before inversions | Ill-conditioned fixture refuses with guidance | Kernel parity | P2 |
| SP-CP-008 | P0 | Basis/mask/grid compatibility rules (SPEC Section 7) enforced on apply | Mismatch fixtures: intersect-warn, resample-confirm, refuse paths | Kernel parity | P2 |
| SP-CP-009 | P1 | nm-space band indices and continuum removal as apply transforms | Oracle comparison | Kernel parity | P2 |
| SP-CP-010 | P0 | `.spb` export/import round-trip (vectors, grid, mask, provenance incl. snapshot id) | Round-trip byte-stability; xarray opens the bundle | Kernel parity | P2 |
| SP-CP-011 | P1 | QA-mask fixed transforms (saturation, dropout, cloud thresholds) accelerated by the stats sidecar (chunk skip on max/histogram envelopes) | Masks match oracle on golden scene; sidecar skip path exercised | Kernel parity | P2 |

## Render Plane (SP-RP)

| ID | P | Requirement | Acceptance | Verification | Gate |
|---|---|---|---|---|---|
| SP-RP-001 | P0 | Fragment path never touches full spectral depth; composites cap at ~8 raw bands | Shader audit; EMIT 285-band scene renders on min-spec WebGL2 | Snapshot | P1 |
| SP-RP-002 | P0 | Derived-tile mode with dual-LUT, visible ramp domain and fill state | Snapshot suite | Snapshot | P2 |
| SP-RP-003 | P0 | Scene mode default (native CRS, pixel-true, planetary-safe); no browser raster warping | Snapshot on UTM + planetary-CRS fixtures | Snapshot | P1 |
| SP-RP-004 | P1 | Basemap mode over ingest-warped pyramid | Snapshot on warped fixture | Snapshot | P3 |
| SP-RP-005 | P0 | Spectral panel: WebGL line/density, library overlays, bad-band shading, basis-as-spectrum | Snapshot + interaction tests | Snapshot | P1/P2 |
| SP-RP-006 | P0 | CVD-safe default ramps; keyboard operability incl. non-pointer brushing | Ramp catalog audit; keyboard walkthrough test | Snapshot | P1 |
| SP-RP-007 | P2 | Flight-plan vector overlay for coverage-vs-plan QA (P5) | Overlay renders planned lines over scene mode | Snapshot | P4+ |

## Coordination (SP-CO)

| ID | P | Requirement | Acceptance | Verification | Gate |
|---|---|---|---|---|---|
| SP-CO-001 | P0 | Mosaic + DuckDB-WASM (single-threaded default) drives cross-panel brushing | Brush propagation under 100 ms at 1M points | Perf harness | P1 |
| SP-CO-002 | P0 | Deterministic, provenance-recorded, visibly indicated feature-space sampling; exact mode at viewport scale | Seed reproducibility test; indicator present | Kernel parity | P1 |
| SP-CO-003 | P0 | USGS library integration with probe-to-match (SAM in SQL) | Match results vs. oracle on golden scene | Kernel parity | P1 |
| SP-CO-004 | P1 | Parquet row groups aligned to spatial chunk boundaries | Alignment assertion in CLI + reader | Store conformance | P1 |

## Cross-cutting (SP-XP)

| ID | P | Requirement | Acceptance | Verification | Gate |
|---|---|---|---|---|---|
| SP-XP-001 | P0 | No mandatory server; air-gap deployment | Offline demo against static file server | Deployment test | P3 |
| SP-XP-002 | P0 | Wavelength as nm coordinate at every API boundary above the chunk layer | API audit; no bare band-index public signatures | Topology audit | P1 |
| SP-XP-003 | P0 | Degradation matrix rows behave as specified with visible state | Matrix rows as test fixtures | Store conformance | P1 |
| SP-XP-004 | P0 | Bundle budget: under 5 MB initial interactive; heavy modules lazy | CI bundle-size gate | CI | P1 |
| SP-XP-005 | P1 | `.sps` session round-trip across browsers; URL-fragment share | Fragment reproduces view, probes, active basis reference, and ramp settings: two browsers show the same figure | Deployment test | P3 |
| SP-XP-006 | P1 | Embeddable mount for MMGIS/OpenMCT hosts | Embedded demo | Deployment test | P3 |
| SP-XP-007 | P0 | CSP baseline per posture; no telemetry by default | CSP header test per posture | Deployment test | P3 |
| SP-XP-008 | P2 | MCP tool surface reusing the SQL layer | Deferred | Parked | P4+ |
| SP-XP-009 | P2 | Posture-4 acceleration: client detects a configured xpublish-tiles/Flux endpoint over the same store and prefers it for spatial raster tiles, seamless fallback to direct reads | Endpoint fixture test; postures 1-3 unaffected when absent | Deployment test | P4+ |

## Design and UX (SP-UX)

Added with the autonomy plan: the v0.4 baseline defined interaction architecture but not design taste; this section closes that gap. The design-reviewer subagent is the verification instrument; DESIGN-BRIEF.md is its criterion source.

| ID | P | Requirement | Acceptance | Verification | Gate |
|---|---|---|---|---|---|
| SP-UX-001 | P0 | DESIGN-BRIEF.md v1 authored (frontend-design skill) before any UI code lands | Brief covers tokens, color doctrine, type ladder, quiet-indicator grammar, motion rules | Bootstrap checklist | P0 |
| SP-UX-002 | P0 | All visual values ship as design tokens in the panel shell; no hardcoded values in components | design-reviewer check 1 clean across shipped surface | Design review | P1 |
| SP-UX-003 | P0 | Quiet-indicator grammar implemented once and reused (sample fraction, ramp domain, level, tier, fill, memory) | Single component family; design-reviewer APPROVE | Design review | P1 |
| SP-UX-004 | P0 | Tabular-numeral readouts; no width-jumping values; nm formatting per brief | Snapshot + design review | Snapshot | P1 |
| SP-UX-005 | P0 | Every UI-touching REQ passes design review before its commit; two consecutive REJECTs escalate | Review verdicts ledgered in STATE.md | Process audit | P1-P3 |
| SP-UX-006 | P1 | Spectral panel signature treatment (additive density, probe foreground, library overlays, bad-band shading) per brief | design-reviewer APPROVE on the signature view | Design review | P2 |
| SP-UX-007 | P1 | No layout shift during asynchronous derived-tile fill | CLS budget in Lighthouse config | CI (lhci) | P2 |
| SP-UX-008 | P0 | First-run surface: open-by-URL (store root, Icechunk repo, or file URL), example gallery backed by the demo mirror, drag-and-drop affordance, recents | First-run journey test: cold browser to rendered scene through each path | Deployment test | P1 |

## Coordination addendum (user-journey review)

| ID | P | Requirement | Acceptance | Verification | Gate |
|---|---|---|---|---|---|
| SP-CO-005 | P1 | Per-probe export: CSV/JSON (wavelengths, values, mask, provenance) and profile-panel figure export (SVG/PNG with axes and annotations) | Exported CSV matches probe values exactly; figure renders standalone | Snapshot | P2 |
