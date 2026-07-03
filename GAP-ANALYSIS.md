# Spectral Prism: Competitive and Adjacent-Approach Gap Analysis

**Status:** Draft v0.2, research snapshot 2026-07. Sources: vendor documentation, project repositories, and OGC/community working-group materials current as of the date above. Matrix rows rot at different rates (ArcGIS Pro and GEE capabilities move quarterly); re-verify any row older than two quarters before citing it externally.

## 1. Landscape Matrix

Legend: Y yes, P partial, N no. "Browser" means runs client-side without mandatory server compute.

| Product / approach | Browser | Cloud-native reads (Zarr/COG) | Spectral analytics depth | GPU client compute | Linked spatial/spectral/feature brushing | Bases/refs as durable objects | Open source | Cost |
|---|---|---|---|---|---|---|---|---|
| ENVI (NV5) | N | P (desktop) | Deep (gold standard) | P (desktop GPU) | P (n-D visualizer, clunky) | P (session-bound) | N | $$$$ |
| ArcGIS Pro 3.6 spectral tools | N | P | Growing (library browser/viewer, target detection wizard, unmixing) | P | P | P | N | $$$ |
| MATLAB Hyperspectral Viewer | N (desktop only; explicitly unsupported in MATLAB Online) | N | Medium (profiles, endmembers, indices) | N | P | P | N | $$$ |
| EnMAP-Box (QGIS plugin) | N | P | Deep, open | N | P | P | Y | Free |
| Napari-based tools (e.g. hyperspectra for AVIRIS-3) | N | N | Medium, education-strong | N | P | N | Y | Free |
| HyperGUI (R Shiny) | P (server-backed) | N | Shallow-medium | N | N | N | Y | Free |
| Yale HSI Viewer | Y (pure frontend, local files, no upload) | N | Shallow (RGB picks, stretch, pixel spectrum) | N | N | N | N (free to use) | Free |
| carbonplan/maps, zarr-gl | Y | Y (Zarr) | None (colormap rendering) | Render only | N | N | Y | Free |
| OpenLayers GeoZarr client rendering (EOPF) | Y | Y (GeoZarr conventions) | None | Render only | N | N | Y | Free |
| TiTiler / xpublish-tiles / Earthmover Flux | N (server tiler) | Y (server side; GDAL-free dynamic tiling of Zarr/Icechunk, GeoZarr multiscales on roadmap) | None (visualization service) | N | N | N | Y / commercial | Free / $$ |
| DeltaBit / AEF embedding viewers | Y | Y (tiles) | Narrow (embedding change detection, browser WebGPU classifier) | Y | N | N | Y | Free |
| Google Earth Engine | P (browser code editor; all compute server-side) | Y (its own catalog, EMIT included) | Medium-deep (unmixing, matched-filter class ops) | N | N | P (assets, script-bound) | N (open client, closed core) | Quota / commercial |
| Server-side UDF platforms (Fused-class), MS Planetary Computer | P (thin client) | Y (server side) | Bring-your-own (Python UDFs) | N | N | N | Mixed | $$ |
| Cuvis.ai / vendor lab HSI suites | N | N | Deep in-lab | P | P | N | Mixed | $$ |
| **Spectral Prism (target)** | **Y** | **Y (Zarr v3, GeoZarr, Icechunk incl. virtual)** | **Deep (decomposition, matching, anomaly, unmixing)** | **Y (WebGPU fit, WebGL2 apply)** | **Y (core interaction)** | **Y (provenance-carrying)** | **Y (Apache 2.0)** | **Free** |

## 2. The Gap, Stated Plainly

Every column-complete row is empty above Spectral Prism's. The landscape splits into three camps that do not overlap:

1. **Deep-analytics desktops** (ENVI, ArcGIS Pro, EnMAP-Box, MATLAB): the science is there, the deployment model is 1998. ArcGIS Pro 3.6's new spectral tooling confirms the analytics demand is current and growing, and confirms Esri is investing in the desktop, not the browser.
2. **Browser Zarr renderers** (carbonplan, zarr-gl, OpenLayers GeoZarr): the data plane is there, the science is a colormap. These are the strongest technical prior art for Spectral Prism's render plane and the clearest evidence the approach works, and none of them treats the spectrum as an object at all.
3. **Server tilers** (TiTiler, xpublish-tiles, Flux): production-grade visualization services that answer "show me the field," never "what is this material." They are complements (an optional low-zoom acceleration path), not competitors.
4. **Thin clients to hyperscaler compute** (Google Earth Engine above all; Fused-class UDF platforms; Planetary Computer). GEE deserves naming explicitly: it is the most-used browser-accessed spectral analysis environment in existence, EMIT sits in its catalog, and it offers unmixing-class operations. It fails the thesis on the axes that matter here: every computation runs server-side on Google infrastructure under quota, nothing deploys or air-gaps, the core is closed, and there is no spectral-workbench interaction model (no linked brushing, no spectrum as a manipulable object). For mission networks the camp is not merely inferior but unavailable. Its existence sharpens rather than threatens the thesis: the question Spectral Prism answers is what spectral analysis looks like when the compute moves into the client instead of the cloud.

Nobody occupies: **browser-native + cloud-native + analytically deep + GPU-computed + linked-brushing.** That intersection is the product.

## 3. Threat and Complement Assessment

- **Most likely fast-follower:** Esri, by porting the Pro 3.6 spectral tools toward ArcGIS Online. Counter-position: openness, mission deployability (air-gap), format neutrality, and zero cost. Esri will not read a colleague's Icechunk repo on an internal object store.
- **Strongest complements:** the Earthmover stack (Icechunk, and Flux/xpublish-tiles as optional server acceleration), VirtualiZarr (the ingest story for archival holdings), the GeoZarr SWG (conventions Spectral Prism both consumes and can pressure-test; the multiscales convention is exactly the pyramid contract ADR-0003 needs), and the NASA-IMPACT/VEDA WebGL-Icechunk roadmap (shared infrastructure interest; their wasm-bindings direction is ADR-0002's Option B).
- **Watch items:** foundation-model embedding products (AEF-class) reframing "spectral analysis" as "embedding similarity" for some user segments; DuckDB Zarr extension codec maturity; any Earthmover move toward first-party browser SDKs.
- **Non-threats commonly mistaken for threats:** Copernicus/EO browsers (catalog viewers, not analysis), Jupyter-based workflows (complementary compute posture, different user moment; Spectral Prism should export artifacts a notebook can consume, i.e. plain Zarr sidecars and Parquet).

## 4. Positioning Sentence

Spectral Prism is to hyperspectral analysis what COG+web-maps was to raster distribution: the moment the format, the reader, and the GPU are all in the client, the desktop moat evaporates. It is the ENVI workflow rebuilt on the 2026 cloud-native stack, open source, running anywhere a browser runs, including inside a mission network.

## 5. Adoption Wedges

1. **EMIT and AVIRIS-3 demo mirrors.** The archives themselves are not browser-reachable as hosted: EMIT granules live in protected LP DAAC buckets requiring Earthdata Login over HTTPS, with direct S3 limited to in-region (us-west-2) temporary credentials. The wedge is therefore CLI-converted scenes (dual-layout GeoZarr plus Icechunk virtual references) republished in a project-hosted, genuinely public, CORS-enabled bucket; NASA data is public domain, so redistribution is clean, and the mirror doubles as the CLI's showcase. Direct-archive access via a user-supplied Earthdata token is tracked as open question Q7 in SPEC.md.
2. **JPL/AMMOS embedding** (MMGIS, OpenMCT) where desktop tools cannot go and licenses do not scale.
3. **The spectral-library moment:** USGS library integration plus probe-to-match is a daily-utility feature that requires none of the heavy fit machinery, so it ships early and hooks users.
