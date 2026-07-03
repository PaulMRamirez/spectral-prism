# Spectral Prism Specification Package: Review of Draft v0.2

**Status:** Review report, 2026-07-01 (second pass). Grading as in the v0.1 review. This pass deliberately hunts in territory the first pass did not: execution topology, numerical correctness, request mechanics, and semantic edge cases an implementation hits in its first weeks. Facts relied on were verified in the v0.1 review's research or are platform-normative (WGSL has no f64; JS numbers are f64; browsers cap per-origin HTTP concurrency).

## Summary Judgment

v0.2's architecture survives this pass structurally: no finding overturns an ADR. But the package still describes *what* computes without saying *where threads live*, describes streaming fits without a *numerical policy*, and states a determinism criterion that is **unsatisfiable as written** (F20). Ship v0.3 before Phase 0.

---

## Findings

### F18 (F-major): Worker topology is unspecified; the main thread will jank

Every plane names its libraries but not its thread. Chunk decode (numcodecs wasm), archival file parsing, and DuckDB all belong off the main thread; a naive implementation decodes zstd on the UI thread and stutters on every pan. **Proposed change (ARCHITECTURE, new Section 2.6):** a decode worker pool (N = hardwareConcurrency-2, floor 2) receiving fetch bytes and returning decoded chunks as **transferable ArrayBuffers** (zero-copy handoff, never structured-clone of typed arrays); a compute orchestrator on the main thread (the WebGPU device lives with the canvas; kernels are async and do not block); DuckDB in its own worker via AsyncDuckDB (already its design); archival parsers in the decode pool. Local ENVI/NetCDF parsing and CLI-less ingest also route through the pool.

### F19 (F-major): Request mechanics are missing: concurrency, coalescing, retry, abort

The scheduler orders priorities but says nothing about the HTTP layer. Zarr v3 sharding means inner chunks are byte ranges within shard objects; adjacent inner-chunk reads should coalesce into merged range requests (zarrita exposes getRange; icechunk-js offers withRangeCoalescing, with the documented caveat that an aborted read in a merged batch may reject its batchmates, so abort scopes must not span independent requests). Browsers cap per-origin connection concurrency; a pan can strand dozens of stale fetches. **Proposed change (fold into 2.6):** a per-origin concurrency budget (default 12 in flight), shard-aware range coalescing with a gap-tolerance threshold, viewport-epoch AbortControllers (one per interaction epoch, never shared across independently cancelable reads), and exponential-backoff retry with jitter distinguishing transient (5xx, network) from permanent (403/404) failures per the degradation matrix.

### F20 (F-crit): The determinism success criterion is unsatisfiable as written, and eigenvector sign is undefined

"A fitted basis exported from one session reproduces identical apply output in another session" fails on two mathematical facts. First, floating-point reduction order differs between WebGPU workgroup reductions and sequential wasm loops (and between GPU vendors), so fits are not bitwise reproducible across tiers. Second, eigenvector sign is arbitrary: -v is as valid as v, so even numerically identical covariance matrices can yield sign-flipped components run to run depending on the solver. **Proposed change:** (a) split the criterion: *apply* determinism (same `.spb`, same input chunks -> bitwise-identical derived tiles within a tier; tolerance-bounded across tiers) from *fit* reproducibility (same tier, same chunk stream order -> identical basis; cross-tier parity within stated tolerance against the NumPy oracle); (b) adopt a **sign convention**: orient each eigenvector so its largest-magnitude coefficient is positive, applied at solve time and recorded in `.spb`; (c) fix component ordering by eigenvalue with a deterministic tiebreak. Belongs in a numerical-policy ADR (F21).

### F21 (F-major): No numerical policy for streaming fits

WGSL has no f64, and naive f32 sum-of-products covariance over 10^5-10^7 pixels in 224 dimensions loses precision exactly where MNF is most sensitive (noise covariance, small eigenvalues). **Proposed change (new ADR-0008):** per-chunk partial statistics in f32 using the pairwise/Welford-style co-moment form (accumulate deviations from a per-chunk running mean, not raw cross-products), hierarchical merge of chunk partials on CPU in f64 (JS numbers), Cholesky/eigen-solve in f64 wasm, condition-number check with UI surfacing before inversion (RX/CEM), and the F20 sign/ordering conventions. The wasm fallback tier implements the identical accumulation tree so cross-tier differences stay tolerance-bounded rather than structural.

### F22 (F-major): Basis/mask compatibility rules for apply are undefined

A basis fitted under band mask M applied to a scene with mask M' (or a different wavelength grid) is undefined behavior in v0.2. **Proposed change (SPEC Section 7 note + prism-core contract):** `.spb` stores the wavelength grid and mask it was fitted on; apply requires grid compatibility (exact, or FWHM-resampled with explicit user confirmation); mask mismatch resolves by intersection with a visible warning and provenance note; refusal when intersection drops below a coverage threshold. Library-matching direction is also normative: resample the **library spectrum to the sensor's bands** (convolve by sensor FWHM), never the image to the library.

### F23 (F-major): "Single cube" needs a definition; flightline reality intrudes

AVIRIS sites arrive as multiple granules. The non-goals exclude two-scene *change detection*, but a VirtualiZarr/Icechunk concatenation of flightlines into one logical datacube is one store and must be in scope, or the tool fails on the most common real acquisition shape. **Proposed change (SPEC Sections 4-5):** define the unit of analysis as the *logical cube* (one store, however virtualized/concatenated it was assembled upstream); exclude cross-*store* workflows only. Nodata seams between flightlines are handled by the F8 nodata semantics.

### F24 (F-minor): Derived tiles need their own statistics

Ramping a derived component requires min/max/percentiles of the *derived* values; the apply pass should emit per-tile stats as it materializes, aggregated per (basis, level) for ramp parameterization, under the no-invisible-decisions rule (the ramp domain is shown).

### F25 (F-minor): Session state has no schema

Phase 3 lists exports but no session artifact. **Proposed:** a versioned session JSON (store URL + snapshot, view state, probes, selections, basis references, ramp settings) serializable to file and URL-fragment-compressed for sharing; named the `.sps` session alongside `.spb`.

### F26 (F-minor): Color-vision-deficiency and keyboard access are unstated

Scientific credibility issue as much as accessibility: default ramp catalog must lead with CVD-safe perceptually uniform ramps (viridis-class), diverging ramps CVD-checked; panels keyboard-navigable; brushing operable without a mouse (arrow-key band cursors at minimum).

### F27 (F-minor): Oracle fixtures should include a real-data golden scene

Synthetic cubes verify plumbing, not science. Commit a small genuine AVIRIS subset with reference PCA/MNF/SAM outputs generated by an independent implementation, tolerance-compared in CI per the F21 policy.

### F28 (F-minor): CSP posture undocumented

wasm-eval, worker-src, and connect-src for arbitrary stores will be interrogated by mission security reviews. One documented CSP baseline per deployment posture (ARCHITECTURE Section 8).

### F29 (F-minor): CLI stack is unpinned

Name the ingest stack: Python, pixi-managed; xarray + VirtualiZarr + Icechunk for virtualization; GDAL for the ADR-0007 basemap warp; explicitly the *only* place GDAL appears in the project.

## Proposed v0.3 Change List

1. ARCHITECTURE 2.6: worker topology + request mechanics (F18, F19).
2. New ADR-0008: numerical policy for streaming fits (F20, F21); SPEC determinism criterion rewritten (F20).
3. SPEC: basis/mask/grid compatibility rules and library resampling direction (F22); logical-cube definition (F23); `.sps` session artifact (F25); CVD/keyboard requirements (F26).
4. ARCHITECTURE Section 3: derived-tile stats emission (F24); Section 8: CSP baseline (F28); CLI stack pin (F29).
5. CLAUDE.md + ROADMAP: numerical policy in testing expectations, golden-scene fixture (F27), Phase 1 gate cites the 100 ms brushing number.

## Left Standing

All seven ADRs, the plane structure, the panel triad, the library selections, and the v0.2 amendments. Nothing in this pass contradicts the v0.1 review's fixes.
