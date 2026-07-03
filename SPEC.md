# Spectral Prism: Specification

**Status:** v0.6 baselined (reviews v0.1-v0.3 + user-journey review with addendum applied; personas P1-P5)
**Date:** 2026-07-01
**Lineage:** Sibling of Raster Prism; shares design DNA, inverts the primary object.

---

## 1. Problem Statement

Hyperspectral data (AVIRIS-class, ~224 bands; EMIT, 285 bands; EnMAP, 246 bands) is among the highest-value and least-accessible imagery in Earth and planetary science. The analytical tooling is desktop-bound (ENVI, ArcGIS Pro, MATLAB Hyperspectral Viewer), expensive, and disconnected from cloud-native data. The few browser tools that exist are either local-file toys with no analytical depth, or server-backed tile viewers that render a colormap but cannot answer a spectral question. A scientist who wants to ask "what material is this pixel, and where else does its signature appear" must download gigabytes and open a desktop application.

Meanwhile the cloud-native storage stack has matured to the point where the browser can be the analysis engine: Zarr v3 with sharding, GeoZarr conventions for georeferencing and multiscales, Icechunk for versioned and virtualized stores, zarrita.js and icechunk-js for browser-side reads, and WebGPU for in-browser linear algebra. Nobody has assembled these into a spectral analysis workbench. Spectral Prism does.

## 2. Vision

**A browser-native analytical workbench for imaging spectroscopy, where the spectrum is the primary object and the image is spatial context.**

Raster Prism's primary object is the image, with the spectrum reached through a probe. Spectral Prism inverts this: every design decision serves the spectrum as a first-class visual and analytical object. The tool loads cloud-hosted hyperspectral cubes directly (no server-side tiler, no preprocessing service), runs fit-phase linear algebra on the client GPU, and gives the scientist a linked spatial / spectral / feature-space triad with brushing across all three.

The founding contract, inherited from Raster Prism: **never let the analytical signal hide the raw data, and always show the relationship between them.** In hyperspectral this matters more, not less; a SAM similarity map looks equally plausible whether the reference spectrum was right or wrong.

## 3. Goals

1. **Zero-install spectral analysis.** A scientist opens a URL, points at a Zarr/GeoZarr/Icechunk store (or drops a local file), and is probing spectra within seconds. No server component required for core function.
2. **Cloud-native data plane.** First-class support for Zarr v3 (sharded), GeoZarr conventions (proj:, spatial:, multiscales, CF wavelength coordinates), and Icechunk repositories including virtual chunks over archival AVIRIS/EMIT granules.
3. **GPU-resident analytics.** Fit-phase reductions (streaming covariance, MNF noise estimation, endmember extraction) run in WebGPU compute; apply-phase transforms (basis projection, similarity mapping) run per-fragment in the render path. Interactive at AVIRIS scale for viewport-sized regions.
4. **Linked spatial-spectral-feature interaction.** Brushing in any panel (map, spectral profile, feature-space scatter) updates the other two in real time. This is the differentiating interaction; desktop tools do it badly and browser tools do not do it at all.
5. **Bases and references as first-class stored objects.** Fitted bases (PCA/MNF eigenvectors), reference spectra, band masks, and per-chunk statistics are durable, shareable artifacts, stored as Zarr attributes / sidecar groups / Icechunk snapshots, never opaque session state.

## 4. Non-Goals

1. **Not a raster visualization tool.** Single-band and few-band color-ramp analysis remains Raster Prism's domain. Concepts flow between the siblings through prism-core, not through scope creep.
2. **No server-side compute in v1.** No tiler, no compute API, no backend database. A future optional acceleration service (for example precomputing multiscales or stats) must never be required for core function.
3. **No atmospheric correction.** Spectral Prism consumes reflectance (or radiance, displayed as-is). L1B-to-L2 processing chains (ISOFIT-class) are upstream science pipelines, not browser work.
4. **No cross-store workflows in v1.** The unit of analysis is the _logical cube_: one store, however it was assembled upstream (a VirtualiZarr/Icechunk concatenation of multiple flightline granules into one datacube is one logical cube and fully in scope; nodata seams between flightlines follow the standard nodata semantics). Two-store comparison and change detection remain out, consistent with the Raster Prism review scoping; fit/apply separability keeps the door open architecturally. Cross-line campaign mosaicking and instrument-health trending across acquisitions are likewise out (F43): P5's supported journey is sequential per-line QA, and trending belongs to ops tooling.
5. **No training of ML models.** Supervised click-to-label classification is a P2 future consideration; foundation-model embeddings (AEF-class) are competitive-watch items, not build targets.

## 5. Primary Object Inversion: Design Principles

1. **The spectrum is the atom.** A pixel is a 224-dimensional vector with wavelength semantics, not a brightness value. Every view, tool, and strategy treats it that way.
2. **Wavelength is a coordinate, not an index.** Band selection, band math, bad-band masks, and cross-sensor reference matching operate in nanometer space. The CF wavelength coordinate variable in GeoZarr metadata is the source of truth; band indices are an implementation detail.
3. **Raw data stays visible.** The three-panel contract from Raster Prism, re-instantiated for the cube (Section 6).
4. **No invisible decisions.** Bad-band masks, resampling to reference-library wavelengths, noise estimation method, overview level in use, and chunk-level statistics provenance are all surfaced in the UI.
5. **Fit and apply are separable.** A fitted basis is a durable object with provenance (source region, band mask, timestamp, algorithm parameters). Apply is a cheap GPU operation against a stored basis. Reference-vector strategies (SAM, SID, CEM) have no fit phase; the reference spectrum plays the role of the basis and gets the same first-class treatment.
6. **Chunking is the scheduling primitive.** I/O, GPU upload, streaming fit, statistics, and cache eviction are all organized around the chunk (see ARCHITECTURE.md Section 3).
7. **Client-side is the architecture, not a constraint.** Everything is designed for object-storage range reads plus browser compute. This is what makes the tool deployable anywhere (public cloud, JPL internal object stores, air-gapped mission networks with a static file server).

## 6. The Panel Triad

Three coordinated projections of one cube, replacing Raster Prism's three renderings of one image:

- **Spatial panel (the map).** Raw composite (true/false color from user-selected wavelengths) or an apply-phase product (PCA component, SAM similarity, abundance). The Standard/Isolated/Composite decomposition from Raster Prism survives here as a rendering mode within this panel. Basemap underlay, scale bar, lat/lon readout via the GeoZarr affine transform.
- **Spectral panel (the profile).** Probe spectra with mean/envelope for region probes; reference-library overlays (USGS spectral library and user libraries); continuum removal toggle; bad-band shading; fitted basis vectors plotted as spectra (an eigenvector is a spectrum, and plotting it is how a scientist sanity-checks a fit); wavelength-space cursors linked to band selection in the spatial panel.
- **Feature-space panel (the scatter).** Pixels projected into a 2D space: PC1/PC2, MNF1/MNF2, band-vs-band, or similarity-vs-similarity. Density shading, lasso selection. Scenes are sampled under an explicit, deterministic, provenance-recorded policy (stratified per chunk, stats-boosted; see ARCHITECTURE Section 5) with a visible sample-fraction indicator, brush-to-refine densification, and an exact mode for viewport-scale extents; sampling is never invisible.

**Linked brushing is the glue.** A selection in any panel highlights corresponding pixels/spectra/points in the other two. Selections are set-algebraic (intersect, union, subtract) and exportable as vector masks.

**Perception and access (normative).** The default ramp catalog leads with color-vision-deficiency-safe, perceptually uniform ramps (viridis-class); diverging ramps are CVD-checked before inclusion. Panels are keyboard-navigable, band cursors are arrow-key operable, and brushing has a non-pointer path.

## 7. Strategy Families

Carried over from the Raster Prism review taxonomy, re-prioritized for spectral-native work:

| Family             | Members (v1 in bold)                                                                | Fit phase                | Notes                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------- |
| Decomposition      | **PCA**, **MNF**, ICA, NMF                                                          | Yes                      | Streaming covariance; MNF adds shift-difference noise estimation with method surfaced in UI |
| Reference matching | **SAM**, SID, adaptive matched filter                                               | No                       | Reference spectrum from probe, library, or upload; wavelength resampling explicit           |
| Anomaly detection  | **RX detector**, CEM                                                                | Yes (covariance inverse) | Inverse-stability handled distinctly from basis stability                                   |
| Fixed transforms   | Band math, **band indices** (NDVI-class generalized to nm-space), continuum removal | No                       | nm-space expressions, not index expressions                                                 |
| QA masks           | **Saturation, dropout, cloud threshold masks**                                      | No                       | P5 journey; stats-sidecar accelerated (chunk skip on max/histogram envelopes)               |
| Unmixing           | Linear unmixing vs. library endmembers                                              | Endmember selection      | P1                                                                                          |
| Clustering         | k-means in reduced space                                                            | Yes                      | P2; Jenks-fragility findings from Raster Prism apply                                        |
| Supervised         | Click-to-label classifier                                                           | Yes                      | P2; probe architecture is the substrate                                                     |

**Compatibility rules (normative).** A basis or reference carries the wavelength grid and band mask it was created under (`.spb`). Apply requires grid compatibility: exact match, or FWHM-based resampling with explicit user confirmation. Mask mismatch resolves by intersection with a visible warning recorded in provenance, and apply refuses when the intersection falls below a coverage threshold. Library matching always resamples the library spectrum to the sensor's bands (Gaussian convolution by sensor FWHM), never the image to the library.

## 8. Data Plane Requirements

- **Native format:** Zarr v3, GeoZarr conventions (proj:, spatial:, multiscales, CF). Wavelength, FWHM, and bad-band list as coordinate variables / attributes.
- **Icechunk repositories** readable in-browser (read-only) including virtual chunks referencing archival granules.
- **Dual layout:** spectral-major primary array (full spectral depth, small spatial extent per chunk, always native CRS) plus a sparse-spaced spatial-major multiscale pyramid for map rendering (4x/16x/64x default), optionally ingest-warped to a display CRS; the browser never warps rasters, and the default display is a pixel-true native-CRS scene mode, which also makes planetary CRS work by construction. External metadata binds the layouts, including each one's CRS, as one logical dataset. (ADR-0003, ADR-0007.)
- **Per-chunk statistics** (min/max, percentiles, histogram sketch, mean spectrum) precomputed into a ZEP0005-aligned stats sidecar (ADR-0003), with the spectral extensions intended for registration in the zarr-conventions framework; the tool degrades gracefully (computes on the fly) when absent.
- **Dtype fidelity:** honor Zarr dtype plus CF scale/offset end to end, applying scale/offset in kernels and shaders, never eagerly materializing float32 copies; the CLI defaults to int16 + scale/offset for the spectral-major array where source precision permits, float32 opt-in. Nodata/fill semantics are defined once in prism-core and respected by stats, fit (masked accumulation), and rendering.
- **Pluggable request authorization** on every store (static headers, bearer tokens, pre-signed URL rewriting) so protected endpoints are reachable without the app owning credential logic.
- **Local file ingest:** ENVI (.hdr + BSQ/BIL/BIP), GeoTIFF stack, and NetCDF (EMIT) via in-browser parsing into the same chunk abstraction, for the drag-and-drop case; files are range-read via Blob.slice, never loaded whole.
- **Companion CLI (`spectral-prism-py` / `sprism`)**, out of browser scope but in project scope: converts archival granules to the dual-layout GeoZarr store, computes multiscales and per-chunk stats, and emits Icechunk virtual references. This is the ingest story; the browser never requires it for already-conformant data.

## 9. Success Criteria (v1)

All targets are stated against a reference baseline: a 2024-class integrated-GPU laptop (no discrete GPU assumed), 50 Mbps bandwidth and 50 ms RTT to the store. Initial interactive bundle under 5 MB; DuckDB-WASM, wasm kernels, and codec modules lazy-loaded.

- Open a cloud-hosted AVIRIS-3 or EMIT scene (GeoZarr or Icechunk) and render a wavelength-selected composite in under 5 seconds.
- Probe-to-spectrum latency under 200 ms for spectral-major layouts.
- PCA/MNF fit over a viewport-scale region (approximately 512x512x224) completes in under 10 seconds via WebGPU, with progress reporting and cancellation; first derived apply tiles for the current viewport appear within 2 seconds of fit completion.
- Linked brushing across all three panels at interactive rates (under 100 ms selection propagation) for 1M+ feature-space points.
- Reproducibility per ADR-0008: apply is bitwise-deterministic within a capability tier for a given `.spb` and input chunks; fit is reproducible within a tier given the same chunk stream; fit and apply are tolerance-bounded across tiers and against the NumPy/SciPy oracle, including the committed real-AVIRIS golden scene; eigenvector sign and ordering follow the recorded conventions.
- A `.sps` session document (versioned JSON: store URL + snapshot, view state, probes, selections, basis references, ramp settings) round-trips a working session across browsers, and compresses into a shareable URL fragment.
- Runs fully offline against a static file server (air-gap deployment test).

## 10. Open Questions

Each question carries a close-by gate. **Disposition rule:** a question still open past its gate becomes either an ADR or an explicitly parked Phase 4+ item, never a rollover.

- **Q1 (engineering; close by Phase 0 gate):** Capability-tier boundaries, resolved as a tier table at the Phase 0 gate rather than as a browser-version question, since the tiers are what the code branches on: tier A (WebGPU compute), tier B (single-threaded wasm kernels, the universal floor), tier C (isolated deployment posture with threaded wasm and threaded DuckDB; see ARCHITECTURE 8.1). Define fit-size guidance per tier.
- **Q2 (data; close by Phase 1 gate):** Which sensor wavelength/FWHM registries ship built-in (AVIRIS-C, AVIRIS-NG, AVIRIS-3, EMIT, EnMAP, PRISMA, Headwall-class lab sensors?) and how are user-defined sensors registered, including lab-frame definitions (wavelength+FWHM CSV, no CRS) as first-class per the user-journey review (F40). The registry pairs with the wavelength-resampling contract (Gaussian convolution by FWHM) in prism-core, required for cross-sensor library matching in v1.
- **Q3 (design; resolved):** Resolved by ADR-0004 as amended: continuum removal is an apply-phase compute transform emitting derived tiles, like every other spectral operation; the per-probe CPU path remains for the spectral panel.
- **Q4 (governance; close by Phase 1 gate):** License Apache 2.0 (default per project preference); confirm USGS spectral library redistribution terms for bundling vs. fetch-on-demand.
- **Q5 (engineering; resolved 2026-07-03):** icechunk-js maturity risk, closed by the posture note docs/research/icechunk-js-posture.md (verified against upstream 2026-07): pin icechunk-js at exactly 0.6.0 as a normal dependency (not vendored), watch the official Earthmover wasm bindings as the successor path, and keep the plain-Zarr HTTP fallback first-class (SP-DP-003, met, commit 17f8943). ADR-0002 already records the decision; conformance fixtures for native and virtual chunks pass (SP-DP-002, commit df4a655). Vendoring is the contingency, entered only via the ROADMAP risk-table response ladder.
- **Q6 (product; close by Phase 2 planning):** MCP Apps surface for Spectral Prism (tool-first queries like "top 5 SAM matches for this spectrum") in v1 or fast-follow.
- **Q7 (product/engineering; close by Phase 2 planning):** Direct access to protected archives (Earthdata-class): is a user-supplied bearer-token flow worth supporting given EDL redirect/CORS friction, or is the CLI-mirror path canonical and documented as such?

## 11. Relationship to the Prism Family

`prism-core` (shared package): store abstraction, chunk cache, strategy registry contract, probe model, panel shell, selection model. `raster-prism` and `spectral-prism` are consumers. Advances made here (WebGPU compute, Zarr store abstraction) backport to Raster Prism through core, not by copy. Distribution target: mission-community-plugins ecosystem; standalone-first, then embeddable into MMGIS / OpenMCT per the established Raster Prism posture.

## 12. Personas and Golden Journeys (added v0.5)

Four personas anchored the v0.5 review; a fifth was added in the v0.6 addendum. Full journeys and findings in docs/reviews/spec-review-v0.4-users.md. **P1, the imaging spectroscopist:** "is there jarosite in this scene, and where?"; ends with a defensible figure and a CSV (SP-CO-005). **P2, the mission ops / science planner** (MMGIS-embedded): triage against a target list; ends with a decision and a share link two browsers render identically (SP-XP-005). **P3, the instrument-lab user:** non-georeferenced bench cubes, oracle-matching trust; served by scene mode, the degradation matrix, and ADR-0008's surfaced fixtures. **P4, the student:** modest hardware, mirror data, learning by seeing; served by the example gallery (SP-UX-008) and neutral tier language (DESIGN-BRIEF). **P5, the airborne instrument operator:** per-line acquisition QA under time pressure ("do we re-fly line 14 before transit home?"); served by sub-5-second cold open, ENVI-first local ingest (SP-DP-011), stats-sidecar QA masks (SP-CP-011), scene mode under weak nav solutions, and the field-LAN posture; cross-line campaign mosaics and instrument-health trending are explicitly out (per-line sequential QA is the journey). Every journey begins at the first-run surface and runs probe-first; features that serve none of the five journeys are scope-gravity suspects by default.
