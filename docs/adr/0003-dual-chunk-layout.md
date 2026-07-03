# ADR-0003: Dual Chunk Layout (Spectral-Major Primary + Spatial-Major Multiscale Pyramid)

**Status:** Accepted (amended v0.5: sparse pyramid spacing, resampling composability rule)
**Date:** 2026-07-01

## Context

The two dominant access patterns pull chunk geometry in opposite directions. Map rendering wants spatial-major chunks (few bands, large spatial extent) so a viewport is few reads. Probing, fitting, and feature-space extraction want spectral-major chunks (all bands, small spatial extent) so a spectrum is one read. This is the BIP/BSQ interleave tradeoff made explicit in chunk shape. Virtual references cannot rechunk, and Zarr v3 sharding only softens (small inner chunks inside larger shard objects) rather than resolves the tension.

## Decision

Materialize both layouts and bind them as one logical dataset via a `spectral_prism:` metadata namespace: a spectral-major primary array (for example 224 x 64 x 64, zstd, sharded, always in the dataset's native CRS) and a spatial-major GeoZarr multiscales pyramid whose resampling method per level is recorded in metadata and which may be materialized in a declared display CRS per ADR-0007; the binding records the CRS of each layout.

**Pyramid spacing (v0.5 amendment, informed by Earthmover's multiscales work):** sparse spacing is the default (4x, 16x, 64x), not dense 2x steps. The storage math is decisive: a full 2x pyramid adds roughly 33% with about three quarters of that in the 2x level alone, while a 4x pyramid adds roughly 6.7%, and renderers tolerate the level-to-zoom mismatch with standard resampling (xpublish-tiles serves multiple zooms from one level routinely). The CLI exposes a 2x level as opt-in for datasets where near-native interaction dominates. **Composability rule:** coarser levels may be derived from finer levels only for composable resampling methods (mean, min, max); median, mode, and nearest-neighbor levels are always computed from native resolution. This dovetails with the overview-fidelity policy (means compose under averaging; order statistics do not). The CLI's pyramid step follows the reference patterns in earth-mover/icechunk-multiscales-demo (two-stage initialization, fork/merge parallel writes with batched commits, resumable execution, skip-empty-tiles) and evaluates carbonplan's ndpyramid/topozarr as implementation bases.

Per-chunk statistics are computed at materialization into a stats sidecar structured per ZEP0005 (chunk-level accumulation groups with per-chunk scalar arrays: min/max, percentiles, sums/counts) and extended with per-chunk mean spectra and histogram sketches; the spectral extensions are intended for registration as a candidate convention in the zarr-conventions framework alongside geo-proj/spatial/multiscales, keeping `spectral_prism:` for genuinely tool-specific binding and provenance metadata only. The companion CLI produces all of this in one pass. Chunk shapes are co-designed with GPU upload: a spatial chunk decodes directly into a texture-array slice; a spectral chunk decodes directly into a WebGPU storage buffer.

**Interop dividend:** because the pyramid is expressed in the standard proj:/spatial:/multiscales conventions, the identical store is directly servable by xpublish-tiles and Flux with no additional work; one store feeds both the client renderer and any optional server tiler (ARCHITECTURE Section 8, posture 4).

## Options Considered

**A. Single spatial-major layout.** COG-equivalent; probes fan out; fit streams are read-amplified. Supported degraded (with UI warning), not recommended.

**B. Single spectral-major layout.** Probes fast; map rendering reads far more bytes than displayed and low zooms are hopeless without a pyramid. Supported degraded.

**C. Single layout + sharding tuned to compromise.** Fewer objects, but inner-chunk reads still pay the interleave penalty in one direction; acceptable middle ground for small scenes only.

**D. Dual layout (chosen).** Roughly 2x storage of one copy (in practice less: the pyramid stores few bands). Storage is the cheapest resource in this system; interaction latency is the scarcest.

## Consequences

Easier: both hot paths hit their ideal geometry; overview-fidelity policy (inherited from Raster Prism findings: means invariant under averaging, clustering fragile, std-dev amplification per sigma) is enforceable because the pyramid's resampling method is chosen and recorded, not inherited; aligning stats with ZEP0005 makes them consumable by non-Prism tooling and converts a private detail into a standards contribution (a seat in the GeoZarr/zarr-conventions conversation on overviews and statistics). Harder: consistency between layouts is an ingest-time responsibility (CLI writes both under one Icechunk transaction where applicable); pyramid band selection (which bands, or PCA-preview bands?) is a design decision surfaced in the CLI; convention registration carries community-process overhead. Revisit: GeoZarr multiscales convention maturation may standardize parts of the binding metadata; zarr-specs #305 (chunk-scaled metadata mechanism) may eventually supersede the sidecar structure.
