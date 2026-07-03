# Spectral Prism Specification Package: Review of Draft v0.1

**Status:** Review report, 2026-07-01. Findings are graded: **F-crit** (correctness or feasibility flaw; must change), **F-major** (materially weakens the design or positioning), **F-minor** (polish). Each finding names the affected documents and the proposed change. Facts marked [verified] were checked against primary sources during this review.

---

## Summary Judgment

The package is coherent and the strategic core survives review: the primary-object inversion, chunk-as-scheduling-primitive, dual layout, client-side posture, and the gap thesis all hold. However, the review found one genuine architecture flaw in the render plane (F1), one missing subsystem (F2, reprojection), two deployment-reality collisions (F3, F4), and a set of alignment opportunities that would strengthen both the engineering and the open-standards positioning. Ship v0.2 before scaffolding Phase 0.

---

## Critical Findings

### F1 (F-crit): The apply-phase rendering design does not survive contact with WebGL2 limits or the dual layout

**Affected:** ARCHITECTURE.md Section 4, ADR-0004.

The v0.1 design has the spatial panel's fragment shader performing the k x bands matmul per fragment against the stored basis. Two independent problems:

1. **Texture-array ceiling.** Per-fragment apply requires the full spectral depth resident as textures. The WebGL2 (OpenGL ES 3.0) guaranteed minimum for MAX_ARRAY_TEXTURE_LAYERS is 256 [verified: Khronos]. AVIRIS (224) fits with no headroom; EMIT (285 bands) and EnMAP (246, plus margin) do not fit on minimum-spec devices at all. Any design premised on "all bands as texture layers" is sensor-fragile.
2. **Layout contradiction.** The spatial panel renders from the spatial-major pyramid, which by ADR-0003 carries only a handful of bands. Full-basis apply therefore cannot run in the display path at zoomed-out levels regardless of texture limits: the data simply is not there.

**Proposed change:** Apply becomes a **compute-side tile materialization**, not a fragment-shader operation. The apply pipeline consumes spectral-major chunks (WebGPU storage buffers, no layer limits; wasm tier identically) and emits **derived product tiles** (scalar or small-vector rasters: component values, similarity scores, abundances) into an in-memory derived-tile cache, organized as its own multiscale pyramid keyed by (basis id, level, tile). The WebGL2 fragment shader then does what fragment shaders are good at: sample the derived tile, apply the dual-LUT ramp, composite. Consequences: the fragment shader simplifies dramatically; EMIT/EnMAP band counts become irrelevant to rendering; the derived pyramid is a natural persistence target (a future write path can commit it back to the store as a GeoZarr multiscales product, closing the loop with the basis-as-artifact principle); zoomed-out apply views are exact rather than approximated from pyramid bands. Cost: apply at a new zoom level is asynchronous (tiles fill in), which is honest and should be visible, consistent with the no-invisible-decisions principle. ADR-0004 should be amended: the split is not "fit=WebGPU, apply=WebGL" but "all spectral math (fit and apply) = compute plane; all display = WebGL2 over derived or raw few-band tiles."

Residual use of wavelength composites (true/false color, up to ~8 user-selected bands) in the fragment path is unaffected and stays.

### F2 (F-crit): Reprojection and non-Earth CRS are unaddressed

**Affected:** ARCHITECTURE.md (missing subsystem), SPEC.md Section 8, new ADR-0007.

The spec never says what projection the map renders in. AVIRIS scenes arrive in UTM zones; EMIT in its own grid; deck.gl's tiling and camera model are Web Mercator-biased; and the stated MMGIS embedding target makes **planetary CRS** (Mars/Moon equirectangular and polar stereographic, custom proj definitions) a first-order requirement, not an exotic case. Client-side raster warping is expensive and easy to get subtly wrong; silently resampling would violate design principle 4.

**Proposed change (ADR-0007):** Two display modes, both explicit in the UI.
1. **Scene mode (default):** render in the dataset's native CRS as a flat scene (deck.gl OrthographicView or equivalent). No warping, no resampling, pixel-true. Graticule and lat/lon readout computed via proj transforms (proj4js/wasm-proj) on coordinates, which is cheap, rather than on pixels, which is not. This mode is CRS-agnostic and therefore planetary-safe by construction, and it matches how spectroscopists actually inspect scenes.
2. **Basemap mode (optional):** the CLI materializes the spatial-major pyramid in a declared display CRS (EPSG:3857 or 4326 for Earth; mission-declared CRS for planetary) at ingest, warping once, server-side, with the resampling method recorded per the overview-fidelity policy. The browser never warps rasters.
The spectral-major array always stays in native CRS; probes and fits are unaffected. This also resolves an ambiguity in ADR-0003: the two layouts may legitimately differ in CRS, and the binding metadata must record both.

### F3 (F-crit): Cross-origin isolation conflicts with fetching cross-origin data, and the memory budget is unowned

**Affected:** ARCHITECTURE.md Sections 5 and 8, ADR-0005, SPEC.md success criteria.

DuckDB-WASM is single-threaded by default; its multi-threaded COI build requires SharedArrayBuffer, which requires the page to be cross-origin isolated (COEP: require-corp, COOP: same-origin) [verified: DuckDB docs/blog]. But an isolated page may only load cross-origin resources that opt in via CORP/CORS headers, which arbitrary object stores and DAAC endpoints will not send. Cross-origin isolation therefore directly conflicts with the "point at any store URL" goal. The same constraint governs any multi-threaded wasm fallback for fit kernels.

**Proposed change:** Make **non-isolated the default deployment posture**: DuckDB-WASM MVP/EH single-threaded bundle (adequate for the workload, which is probe/selection/library tables, not TPC-H), single-threaded wasm fit fallback (slower, honest, surfaced). Document an **opt-in isolated posture** for controlled deployments (mission-internal, where one team owns both app and data hosts and can set CORP headers) that unlocks threaded DuckDB and threaded wasm kernels. Add a deployment-matrix subsection to ARCHITECTURE.md Section 8 covering the header requirements per posture.

Relatedly: the browser tab is a ~2-4 GB world (Chrome wasm heaps cap near 4 GB) [verified], and v0.1 assigns 512 MB to the chunk cache without owning the whole. **Add a global memory governor** in prism-core with explicit sub-budgets (decoded-chunk cache, derived-tile cache, DuckDB, GPU staging, feature-space buffers), pressure-driven eviction across all of them, and a visible memory readout (no invisible decisions applies to resources too).

### F4 (F-major): The EMIT adoption wedge overstates public accessibility

**Affected:** GAP-ANALYSIS.md Section 5, SPEC.md Section 8, ROADMAP.md Phase 0.

EMIT granules live in LP DAAC **protected** buckets: HTTPS requires Earthdata Login, and direct S3 requires temporary STS credentials valid only in-region (us-west-2) [verified: NASA EMIT-Data-Resources, LP DAAC docs]. Browser EDL auth involves redirect chains that are hostile to CORS-constrained fetch. "Zero-friction public demos on EMIT open data" is therefore not literally achievable against the archive as hosted.

**Proposed change:** (a) Reframe the wedge: the CLI converts/virtualizes EMIT and AVIRIS-3 scenes into a **project-hosted, genuinely public, CORS-enabled bucket** (NASA data is public domain; redistribution is clean), which simultaneously demos the CLI. (b) Add **pluggable request authorization** to the store abstraction (static headers, bearer tokens, pre-signed URL rewriting); icechunk-js already accepts custom headers [verified], and plain-Zarr fetch trivially does. (c) Add open question Q7: whether an EDL token-paste flow (user supplies a bearer token) is worth supporting for direct-archive access, versus documenting the mirror path as canonical.

---

## Major Findings

### F5 (F-major): Per-chunk statistics should align with ZEP0005 and the Zarr Conventions framework, not live in a bespoke namespace

**Affected:** ADR-0003, ARCHITECTURE.md Section 2.3, GAP-ANALYSIS.md Section 3.

ZEP0005 (Zarr chunk-level accumulation, NASA GES DISC) formalizes storing chunk-interval cumulative sums and explicitly notes the same mechanism serves chunk statistics (min, max, sum, count) stored alongside the arrays [verified: zarr.dev/zeps draft]; zarr-specs #305 discusses a general mechanism for chunk-scaled metadata. The `spectral_prism:` stats sidecar as drafted reinvents this privately.

**Proposed change:** Structure the stats sidecar to be ZEP0005-shaped where the concepts overlap (accumulation groups, per-chunk scalar arrays), and register the spectral extensions (per-chunk mean spectrum, histogram sketch) as a **candidate convention in the zarr-conventions framework**, alongside geo-proj/spatial/multiscales. This is also a strategy play: it converts an internal design detail into a contribution to the GeoZarr/Zarr conventions ecosystem, consistent with the project's Apache-heritage posture and giving Spectral Prism a seat in the SWG conversation on overview/statistics standards. Keep `spectral_prism:` only for genuinely tool-specific binding metadata (dual-layout pairing, basis provenance schema).

### F6 (F-major): The gap analysis omits Google Earth Engine and the server-side UDF platforms

**Affected:** GAP-ANALYSIS.md Sections 1-3.

GEE is the most-used "browser-accessed" spectral analysis environment in existence: EMIT is in its catalog, it offers unmixing and matched-filter class operations, and its code editor runs in a browser. It fails the thesis on the axes that matter (all compute server-side on Google infrastructure, quota-governed, not deployable, not air-gappable, closed core, no linked spectral workbench interaction), but a gap analysis that does not name it invites the obvious rebuttal. Same for the newer server-side UDF platforms (Fused-class) and Microsoft Planetary Computer.

**Proposed change:** Add a GEE row (Browser: P via hosted editor; analytics: medium-deep server-side; GPU client: N; brushing: N; durable bases: P; open: N; cost: quota/commercial) and a short paragraph in Section 2 naming the "browser as thin client to hyperscaler compute" camp as the fourth camp, distinct from all three existing ones, and why the client-side thesis is a different (and for mission networks, the only viable) answer.

### F7 (F-major): prism-core extraction is sequenced too early

**Affected:** ADR-0006, ROADMAP.md Phase 0.

Extracting the strategy registry, probe model, and panel shell into prism-core before spectral-prism has a single working strategy risks abstracting from one consumer's shape, the classic premature-generalization failure. The store abstraction genuinely is needed by both siblings immediately; the rest is speculative until the second consumer exists.

**Proposed change:** Split the extraction. Phase 0 extracts only the **data-plane core** (store abstraction, chunk cache/scheduler, GeoZarr convention reader, memory governor). The strategy registry, probe/selection models, and panel shell are extracted at the **end of Phase 2**, once spectral-prism's fit/apply and probes have demonstrated their real shape against raster-prism's existing one. Rule of thumb for the repo: core admits an abstraction only after both consumers exhibit it.

### F8 (F-major): Data types, scaling, and quantization are unspecified

**Affected:** SPEC.md Section 8, ARCHITECTURE.md Sections 2-4.

Reflectance products ship as float32 or scaled int16; the spec is silent. The difference is 2x across the entire memory and bandwidth budget, and GPU sampling of integer textures vs. float buffers differs.

**Proposed change:** Requirements: (a) honor Zarr dtype + scale/offset (CF conventions) end to end, applying scale/offset in shaders/kernels, never eagerly materializing float32 copies; (b) the CLI defaults to int16 + scale/offset for the spectral-major array where the source precision permits, float32 opt-in; (c) nodata/fill semantics defined once in prism-core and respected by stats, fit (masked accumulation), and rendering.

### F9 (F-major): Feature-space needs an explicit sampling policy

**Affected:** ARCHITECTURE.md Section 5, SPEC.md Section 6.

A full AVIRIS scene approaches 10^8 pixels; "1M+ points" in the scatter implies sampling, but no policy is stated, and an unstated sampling policy is an invisible decision.

**Proposed change:** Define a stratified per-chunk sampling policy (uniform rate within chunk, chunk-stats-aware boosting for high-variance chunks, deterministic seed recorded in provenance), a visible sample-fraction indicator on the panel, brush-to-refine (selections can trigger densified resampling within the selected region), and exact mode for viewport-scale regions.

---

## Minor Findings

- **F10:** Success criteria lack a hardware and network baseline. Define the reference: 2024-class integrated-GPU laptop, 50 Mbps / 50 ms RTT to the store; restate the 5 s / 200 ms / 10 s targets against it. Add a bundle budget: initial interactive < 5 MB, DuckDB-WASM and wasm kernels lazy-loaded.
- **F11:** Local-file ingest must stream. Multi-GB ENVI cubes cannot be read whole into memory; use Blob.slice range reads against the File handle, treating the local file as a range-readable store like any other. One sentence in ARCHITECTURE 2.1 fixes it.
- **F12:** Error/degradation matrix missing. Add a table: missing proj: / missing wavelengths / missing stats / single layout / no WebGPU / no CORS, each mapped to behavior and user messaging. Several rows exist implicitly; make them normative.
- **F13:** Basis export format needs a name and a mini-spec. Propose `.spb` (Spectral Prism Basis): a small self-describing Zarr group (zip-packed) containing eigenvectors/reference spectra, wavelength grid, band mask, provenance JSON. Zarr-in-zip keeps it readable by xarray, serving the notebook-interop complement identified in the gap analysis.
- **F14:** Wavelength resampling (Gaussian convolution by FWHM for cross-sensor library matching) is implied but never specified; it belongs in the prism-core contract with the sensor registry (Q2), since SAM against a library is a v1 feature.
- **F15:** Q1 (WebGPU floor) should be resolved as a capability-tier table at the Phase 0 gate (tier A: WebGPU compute; tier B: single-threaded wasm; tier C: isolated deployment with threaded wasm), rather than as a browser-version question; the tiers are what the code actually branches on.
- **F16:** Naming hygiene: check `sprism` for CLI namespace collisions on PyPI before Phase 0; `spectral-prism-py` as the package with `sprism` as entry point is fine if free.
- **F17:** GAP-ANALYSIS should date-stamp the matrix rows individually; ArcGIS Pro and GEE capabilities move quarterly and the matrix will otherwise rot silently.

---

## Proposed v0.2 Change List (in application order)

1. ARCHITECTURE Section 4 + ADR-0004 amendment: derived-tile apply pipeline (F1).
2. New ADR-0007: display projection model, scene mode + basemap mode (F2).
3. ARCHITECTURE Section 8: deployment postures with COOP/COEP matrix; prism-core memory governor (F3).
4. GAP-ANALYSIS: GEE + fourth camp; wedge reframe to project-hosted mirrors; auth pluggability into store abstraction; Q7 (F4, F6).
5. ADR-0003 + Section 2.3: ZEP0005 alignment and zarr-conventions registration intent (F5).
6. ADR-0006 + ROADMAP: two-stage core extraction (F7).
7. SPEC Section 8 + ARCHITECTURE: dtype/scale/nodata requirements (F8); feature-space sampling policy (F9).
8. Minor batch: F10-F17.

## What Was Reviewed and Deliberately Left Standing

Zarr v3 + GeoZarr as native format (ADR-0001), zarrita + icechunk-js with plain-Zarr fallback (ADR-0002), the dual layout itself (ADR-0003; strengthened, not weakened, by F1 and F2), Mosaic + DuckDB-WASM (ADR-0005; the coordination workload is single-thread-friendly, so F3 does not undermine it), the panel triad and strategy families, and the phase-gated roadmap shape. The gap thesis survives with the F6 addition; the fourth camp strengthens rather than threatens it.
