# Spectral Prism: Architecture

**Status:** v0.6 baselined (reviews and addendum applied; ADR-0003 amended for sparse pyramids; posture 4 documented). Decisions with real alternatives are captured as ADRs 0001-0008 in `docs/adr/`; this document describes the whole and points at them.

---

## 1. Overview: Four Planes and a Coordinator

```
+------------------------------------------------------------------+
|                        UI SHELL (React)                          |
|   Spatial Panel    |   Spectral Panel   |  Feature-Space Panel   |
|  (deck.gl custom   |  (WebGL line/      |  (regl-scatterplot)    |
|   layer, dual-LUT  |   density renderer)|                        |
|   fragment shader) |                    |                        |
+---------+-------------------+---------------------+--------------+
          |     COORDINATION PLANE: Mosaic selections over          |
          |     DuckDB-WASM (probe/region/selection/library tables) |
+---------+-------------------+---------------------+--------------+
|  RENDER PLANE (WebGL2)      |   COMPUTE PLANE (WebGPU or wasm)   |
|  ramps and composites raw   |   fit: streaming covariance, noise |
|  few-band tiles and derived |   estimation, RX inverse; apply:   |
|  product tiles via dual-LUT |   basis/ref projection -> tiles    |
+-----------------------------+------------------------------------+
|                DATA PLANE (chunk-centric)                        |
|  zarrita.js  <-- icechunk-js (Icechunk repos, virtual chunks)    |
|              <-- FetchStore (plain Zarr v2/v3 over HTTP)         |
|              <-- LocalStore (ENVI/GeoTIFF/NetCDF wasm parsers)   |
|  numcodecs-wasm decode -> typed arrays -> LRU chunk cache        |
|  GeoZarr convention reader (proj:, spatial:, multiscales, CF)    |
+------------------------------------------------------------------+
```

All planes are browser-resident. The only network dependency is HTTP range/object reads against the store.

## 2. Data Plane

### 2.1 Store abstraction

A single `SpectralStore` interface with three implementations:

- **ZarrHttpStore:** zarrita.js `FetchStore` for plain Zarr v2/v3 (consolidated metadata preferred, sharding supported).
- **IcechunkStore:** icechunk-js, which implements zarrita's AsyncReadable interface, providing read-only access to Icechunk repos over HTTP including branch/tag/snapshot selection and virtual chunks (with optional checksum validation). This is how archival AVIRIS/EMIT granules arrive without conversion: VirtualiZarr-produced references resolved client-side. (ADR-0002.)
- **LocalStore:** drag-and-drop ENVI/GeoTIFF/NetCDF parsed in a worker (geotiff.js reused from Raster Prism; ENVI header parser is trivial; NetCDF via h5wasm for EMIT). Local files are never read whole: Blob.slice range reads treat the File handle as a range-readable store, and chunks materialize into the same chunk abstraction so downstream planes never special-case them.

All store implementations accept a pluggable request-authorization hook (static headers, bearer tokens, pre-signed URL rewriting); icechunk-js already supports custom headers and plain-Zarr fetch trivially does. This is how protected endpoints (Earthdata-class) are reached without the app ever owning credentials logic.

### 2.2 GeoZarr convention reader

A small module that resolves, in priority order: `zarr_conventions` registrations, proj: (CRS), spatial: (affine transform), multiscales (pyramid levels and their resampling method), and CF coordinate variables (wavelength in nm, FWHM, bad-band flags). Missing conventions degrade to explicit UI prompts, never silent assumptions (design principle 4). The reader is convention-versioned; GeoZarr is pre-1.0 (OGC review targeted summer 2026) and the module isolates spec churn.

### 2.3 Dual layout binding

The logical dataset binds two physical arrays (ADR-0003):

- `spectral/` : spectral-major chunks, for example (bands, 64, 64) with full spectral depth. Serves probes, fit sampling, and feature-space extraction. One object read yields a full local spectrum block.
- `spatial/<level>/` : spatial-major multiscale pyramid, for example (1..8 bands, 256, 256) per level, GeoZarr multiscales convention at sparse spacing (4x/16x/64x default, 2x opt-in per ADR-0003 as amended; the identical store is thereby servable by xpublish-tiles/Flux, posture 4). Serves map tiles.

Binding metadata (a `spectral_prism:` attribute namespace) declares the pairing, the CRS of each layout (they may legitimately differ per ADR-0007: spectral-major always native CRS, the pyramid optionally warped to a display CRS at ingest), the stats sidecar location, and provenance. The stats sidecar itself is ZEP0005-shaped (chunk-level accumulation groups with per-chunk scalar arrays: min/max, percentiles, sums/counts) extended with per-chunk mean spectra and histogram sketches; the spectral extensions are intended for registration as a candidate convention in the zarr-conventions framework rather than remaining tool-private (ADR-0003). When only one layout exists, the tool runs degraded: spatial-only stores get slow probes (fan-out reads) with a UI warning; spectral-only stores render the map from decimated spectral chunks.

### 2.4 Chunk cache and scheduler

Chunk identity `(array, level, index, snapshot)` keys an LRU over decoded typed arrays. A priority scheduler orders fetches: visible-viewport spatial chunks first, then probe-adjacent spectral chunks, then prefetch ring, then fit-stream chunks (which are also the lowest-priority evictees since the fit consumes each chunk once). Per-chunk stats from metadata feed a skip index: strategy scans (for example RX thresholding) skip chunks whose stat envelope cannot contain a hit.

### 2.5 Memory governor

The browser tab is a roughly 2-4 GB world and no single cache may own it. prism-core provides a global memory governor with explicit sub-budgets: decoded-chunk cache, derived-tile cache (Section 3), DuckDB-WASM, GPU staging, and feature-space buffers. Eviction is pressure-driven across all pools, budgets are configurable per deployment, and current usage is visible in the UI (the no-invisible-decisions principle applies to resources too). Default envelope: 1.5 GB total, with 512 MB chunks / 256 MB derived tiles / 512 MB DuckDB / the remainder staging.

### 2.6 Worker topology and request mechanics

Threads are explicit. A decode worker pool (hardwareConcurrency minus 2, floor 2) receives fetched bytes and returns decoded chunks as transferable ArrayBuffers (zero-copy handoff; typed arrays are never structured-cloned); archival file parsers (ENVI, h5wasm, geotiff.js) run in the same pool. DuckDB runs in its own worker via AsyncDuckDB. The compute orchestrator lives on the main thread with the WebGPU device and canvas; kernels are asynchronous and never block the UI. wasm fit kernels in the fallback tier run in the decode pool.

At the HTTP layer the scheduler enforces: a per-origin in-flight budget (default 12); shard-aware range coalescing (adjacent inner-chunk reads within a gap-tolerance threshold merge into one range request; icechunk-js withRangeCoalescing where applicable, noting its documented caveat that an abort within a merged batch may reject batchmates, so abort scopes never span independently cancelable reads); viewport-epoch AbortControllers (one per interaction epoch, retired wholesale on pan/zoom); and exponential-backoff retry with jitter that distinguishes transient failures (5xx, network) from permanent ones (403/404), routing the latter to the degradation matrix (Section 9).

## 3. Compute Plane (WebGPU)

The compute plane owns all spectral mathematics, both fit and apply (ADR-0004 as amended). The render plane never touches full spectral depth; this is what keeps EMIT-class band counts (285, beyond the WebGL2 guaranteed 256-layer texture-array minimum) irrelevant to rendering.

**Apply-phase tile materialization.** Applying a basis or reference (PCA/MNF projection, SAM/CEM/RX scoring, unmixing, continuum removal) is a compute pass over spectral-major chunks (storage buffers, no layer limits; identically shaped wasm kernels in the fallback tier) that emits **derived product tiles**: scalar or small-vector rasters organized as their own in-memory multiscale pyramid keyed by (basis id, level, tile), managed under the memory governor's derived-tile budget. Each pass also emits per-tile statistics (min/max, percentile sketch), aggregated per (basis, level) to parameterize the ramp, whose domain is always shown. Derived tiles fill in asynchronously as the viewport moves, and the fill state is visible. The derived pyramid is also the natural future persistence target: a write path can commit it back to the store as a GeoZarr multiscales product, closing the loop with the basis-as-artifact principle.

All fit kernels follow the numerical policy of ADR-0008: f32 per-chunk co-moment partials (Welford-form, never raw cross-products), deterministic hierarchical merge in f64 on CPU, f64 solves with condition-number surfacing, eigenvector sign and ordering conventions recorded in `.spb`.

Fit-phase kernels, all structured as chunk-stream reductions:

- **Streaming covariance / mean:** per-chunk partial sums in a compute pass, merged on a small accumulator buffer. 224x224 covariance is 50 KB; trivially GPU-resident.
- **MNF noise estimation:** shift-difference within chunk interiors (chunk-boundary pixels excluded and counted, surfaced in provenance), producing the noise covariance alongside the signal covariance.
- **Eigen-solve:** 224x224 symmetric eigendecomposition runs on CPU (wasm, LAPACK-lite or a Jacobi implementation); at this size CPU is microseconds and avoids WebGPU numerics risk. Bases uploaded back as uniform/storage buffers.
- **RX / CEM:** covariance inverse via CPU Cholesky (same size argument); Mahalanobis scoring runs as an apply-phase compute pass emitting derived tiles.
- **Feature-space projection:** chunk-stream matmul producing (N, 2) point buffers consumed directly by the scatter renderer, plus Parquet-encoded samples handed to DuckDB-WASM.

Every kernel reports progress per chunk, supports cancellation, and records provenance (chunks consumed, band mask, parameters) into the basis object. Fallback when WebGPU is absent: identical kernels compiled to wasm (single-threaded acceptable for reduced sample counts), selected transparently, surfaced in the UI. (Open question Q1 refines the floor.)

## 4. Render Plane (WebGL2)

- **Spatial panel:** deck.gl provides viewport, tiling, and interaction plumbing (display projection model per ADR-0007: native-CRS scene mode default, warped-pyramid basemap mode optional); the science rendering is a custom layer whose fragment shader implements: (a) wavelength-composite mode (up to 8 user-selected bands from a texture array, matrix to RGB), (b) derived-tile mode (sample the apply-phase product tile, dual-LUT ramp, composite; the shader never sees full spectral depth), (c) the Standard/Isolated/Composite decomposition as a mode switch. Raw chunk textures upload as texture-array slices sized to match storage chunks (co-design per ADR-0003); integer dtypes upload as-is with CF scale/offset applied in-shader, never eagerly materialized to float32.
- **Spectral panel:** custom WebGL line renderer (regl): instanced polylines for up to a few thousand overplotted spectra with additive-density blending; SVG/canvas overlay for axes, cursors, band-mask shading, and library annotations. SVG chart libraries are explicitly rejected for the hot path (they die at hundreds of 224-point lines).
- **Feature-space panel:** regl-scatterplot; millions of points, lasso/rectangle selection, density shading.

WebGL2 (not WebGPU) for rendering keeps the floor low: every target browser renders even when compute falls back to wasm.

## 5. Coordination Plane (Mosaic + DuckDB-WASM)

DuckDB-WASM holds the relational side of the workbench: probe tables (probe id, position, full spectrum as list column), region stats, selection sets, feature-space samples (Parquet, row groups aligned to spatial chunk boundaries), reference libraries (USGS and user), and the chunk/stats manifest itself. Mosaic coordinates cross-filtering: panel selections are Mosaic selections; brushing compiles to DuckDB predicates; the map and scatter renderers subscribe as Mosaic clients. This puts DuckDB on the interaction path, not just the analytics rail, and is the architectural through-line shared with TACIT. (ADR-0005.)

GPU-side selection highlighting uses a selection-mask texture updated from DuckDB result bitmaps, so brushing never re-uploads pixel data.

DuckDB-WASM runs the single-threaded MVP/EH bundle by default: the workload (probe, selection, library, and manifest tables) is single-thread-friendly, and the threaded COI build requires cross-origin isolation, which conflicts with fetching arbitrary cross-origin stores (Section 8). The threaded build is available in the isolated deployment posture only.

**Feature-space sampling policy.** A full scene approaches 10^8 pixels; the scatter is sampled, and the sampling is never invisible. Policy: stratified per-chunk sampling (uniform rate within chunk, boosted for high-variance chunks per the stats sidecar), deterministic seed recorded in provenance, a visible sample-fraction indicator on the panel, brush-to-refine densification within selected regions, and exact (unsampled) mode for viewport-scale extents.

## 6. Library Selections (summary; rationale in ADRs)

| Concern | Selection | Alternates considered |
|---|---|---|
| Zarr access | zarrita.js | zarr.js (older, less modular) |
| Icechunk access | icechunk-js (EarthyScience) | Icechunk wasm bindings (heavier, not shipped); server-side proxy (violates client-side goal) |
| Chunk decode | numcodecs wasm builds (zstd, blosc/lz4, gzip) | JS codecs (slower) |
| Map framework | deck.gl + custom layer | MapLibre custom layer (weaker n-dim story); OpenLayers (GeoZarr precedent exists but custom-shader ergonomics worse); carbonplan/maps and zarr-gl (strong prior art, too colormap-centric for matmul apply) |
| Scatter | regl-scatterplot | deck.gl ScatterplotLayer (fine fallback, same GL context option) |
| Spectral lines | custom regl renderer | ECharts/Plotly/Observable Plot (rejected for hot path; Plot acceptable for small statistical charts) |
| Coordination | Mosaic + DuckDB-WASM | Crossfilter (does not scale); bespoke event bus (reinvention) |
| Compute | WebGPU compute + wasm fallback | tfjs (wrong shape of API); gpu.js (unmaintained) |
| Eigen/linear algebra (CPU) | wasm LAPACK subset or hand-rolled Jacobi | ml-matrix (acceptable bootstrap) |
| Local file parse | geotiff.js, h5wasm, custom ENVI parser | server-side conversion (violates goal) |
| Projection math | proj4js / wasm-proj, coordinates only, never raster warping (ADR-0007) | client raster warp (rejected: cost, silent resampling) |
| UI shell | React + Vite, ES module output | matches Raster Prism / MMGIS consumption pattern |
| App packaging | PWA; Electron optional later | mirrors Bessel posture |

## 7. Data Flow: Two Canonical Traces

**Probe:** click on map -> pixel to array index via affine transform -> spectral-major chunk fetch (cache hit or one object read) -> spectrum extracted -> inserted into DuckDB probes table -> Mosaic notifies spectral panel (renders line) and feature-space panel (highlights point) -> reference-library nearest-match query (SAM in SQL over library table, or GPU for large libraries) annotates the profile.

**Fit-then-apply (MNF):** user draws region + band mask -> scheduler streams spectral chunks intersecting region -> WebGPU accumulates signal and noise covariance with progress UI -> CPU eigen-solve -> basis object created (provenance recorded, including Icechunk snapshot id where applicable), stored in session and exportable as a `.spb` bundle (F13: a zip-packed self-describing Zarr group holding eigenvectors/reference spectra, wavelength grid, band mask, and provenance JSON, readable by xarray) or committed to the store via the companion CLI -> apply-phase compute pass materializes derived MNF component tiles for the viewport, filling asynchronously -> spatial panel renders the derived tiles through the dual-LUT -> feature-space panel re-projects onto MNF1/MNF2 -> spectral panel plots the top eigenvectors as spectra for sanity-checking.

## 8. Deployment Postures

1. **Static hosting + public object store** (the demo posture): the app is files on a CDN; data is Zarr/Icechunk on S3-compatible storage with CORS. Demo datasets are CLI-converted mirrors in a project-hosted, genuinely public, CORS-enabled bucket (protected archives like LP DAAC EMIT cannot be fetched browser-side without auth; see GAP-ANALYSIS Section 5 and Q7).
2. **Mission-internal:** same app served from an internal static server against internal object stores; air-gap compatible by construction (success criterion).
3. **Embedded:** the panel triad packaged as an embeddable component (mountable pattern per LithoSphere/Raster Prism precedent) for MMGIS and OpenMCT hosts, with the host supplying viewport and layer-stack context.
4. **Accelerated (optional, v0.5):** an xpublish-tiles instance (or hosted Flux) pointed at the *same store* serves raster tiles for low zooms and very large mosaics; the client detects the endpoint via configuration and prefers it for spatial-panel raster tiles where present, falling back to direct chunk reads seamlessly. This is the deliberate, bounded loosening of the client-side constraint: rendering acceleration may be server-assisted because the store is the contract (identical GeoZarr multiscales feed both renderers), while analytics (probes, fit, apply, brushing) remain client-side unconditionally, preserving the differentiation and the air-gap guarantee (postures 1-3 never require posture 4). Implementation is Phase 4+ (SP-XP-009); the posture is documented now so the store design never forecloses it.

### 8.1 Isolation postures (COOP/COEP)

Cross-origin isolation (COEP: require-corp + COOP: same-origin) unlocks SharedArrayBuffer and therefore threaded DuckDB-WASM and threaded wasm kernels, but an isolated page may only fetch cross-origin resources that opt in via CORP/CORS, which arbitrary stores will not send. The two goals conflict, so the posture is explicit:

| Posture | Headers | DuckDB | wasm kernels | Data reachability |
|---|---|---|---|---|
| **Open (default)** | none | single-threaded MVP/EH | single-threaded | any CORS-enabled store |
| **Isolated (opt-in)** | COEP + COOP set; data hosts send CORP/CORS | threaded COI build | threaded | only hosts the deployer controls (mission-internal fit) |

WebGPU availability is orthogonal to this choice; capability tiers are defined in SPEC Q1.

### 8.2 CSP baseline and CLI stack

Mission security reviews will interrogate the Content-Security-Policy; the documented baseline per posture: `script-src 'self' 'wasm-unsafe-eval'` (wasm modules), `worker-src 'self'` (decode pool, DuckDB), `connect-src` enumerating the deployment's store origins (open posture may require user-extended allowlists; air-gapped posture enumerates exactly its internal endpoints). No third-party origins are required by the app itself; no telemetry is emitted by default.

The companion CLI stack is pinned here as the single source of truth: Python, pixi-managed environment; xarray + VirtualiZarr + Icechunk for conversion and virtualization; GDAL exclusively for the ADR-0007 basemap warp, the only place GDAL appears anywhere in the project.

## 9. Degradation and Error Matrix

Normative behavior when inputs fall short; every row surfaces its state in the UI, never silently.

| Condition | Behavior |
|---|---|
| Missing proj: / spatial: conventions | Scene mode only (ADR-0007); pixel coordinates shown; user may supply CRS/geotransform manually |
| Missing wavelength coordinate | Band indices shown with a warning banner; nm-dependent strategies (library match, indices, continuum removal) disabled until a sensor registry entry or user mapping is applied (Q2) |
| Missing stats sidecar | Stats computed on the fly per viewport; skip-index and instant-ramp features unavailable; CLI suggested |
| Single layout (spatial-only) | Probes fan out with a latency warning; fit disabled above a size threshold |
| Single layout (spectral-only) | Map rendered from decimated spectral chunks; zoomed-out quality warning |
| No WebGPU | wasm kernel tier; fit-size guidance shown; rendering unaffected |
| CORS failure / auth required | Explicit error naming the header or credential missing, with the request-authorization hook documented; never a blank canvas |
| Memory pressure | Governor evicts by pool priority; visible budget readout; fit refuses to start if its stream cannot fit the staging budget |

## 10. Explicitly Deferred

Posture-4 acceleration implementation (xpublish-tiles/Flux endpoint preference in the client; the posture itself is documented in Section 8), write-enabled Icechunk sessions from the browser, two-scene workflows, WebGPU rendering unification, volume rendering of the cube (novelty-ranked), and MCP Apps surface (Q6).
