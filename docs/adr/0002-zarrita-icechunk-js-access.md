# ADR-0002: zarrita.js + icechunk-js for Browser Data Access; Virtualization for Archival Data

**Status:** Accepted
**Date:** 2026-07-01

## Context

The client-side goal forbids a mandatory server. Data arrives in three shapes: conformant Zarr/GeoZarr stores; Icechunk repositories (including virtual chunks referencing archival AVIRIS/EMIT granules produced by VirtualiZarr); and raw archival files (ENVI, GeoTIFF, EMIT NetCDF). The archival case is the strategic one: most hyperspectral holdings will never be rewritten, and virtualization (chunk references, not copies) is how they become cloud-optimized without anyone's permission.

## Decision

zarrita.js is the Zarr access layer (v2/v3, sharding, tree-shakeable, AsyncReadable store interface). icechunk-js (EarthyScience's read-only TypeScript reader, which implements zarrita's AsyncReadable including getRange for sharded arrays, HTTP storage, branch/tag/snapshot selection, manifest LRU caching, and virtual-chunk reads with optional checksum validation) is the Icechunk layer. Local archival files parse in a worker into the same chunk abstraction. Server-side ingest (VirtualiZarr -> Icechunk, dual-layout materialization) lives in the companion CLI, outside the browser.

## Options Considered

**A. Plain Zarr only.** Simplest; excludes virtualized archival data, versioning, and snapshot-pinned reproducibility. Kept as the universal fallback, insufficient alone.

**B. Icechunk Rust core via wasm-bindgen.** The NASA-IMPACT/VEDA roadmap direction (zero-copy WASM-to-WebGL buffers). Most performant end state; heavy build/maintenance investment, upstream wasm compilation not a current Icechunk priority. Deferred, watched.

**C. icechunk-js + zarrita (chosen).** Pure TypeScript, browser-native today, designed for zarrita. Risk: young community project (MIT, small maintainer set); mitigated by pinning, a contribution posture, conformance tests against Icechunk fixtures in CI, and the plain-Zarr fallback remaining first-class.

**D. Server-side tiler (TiTiler/xpublish-tiles).** Excellent prior art, wrong architecture for this project's goals; noted as an optional future acceleration path only.

## Consequences

Easier: virtualized archival access with zero data duplication; snapshot-pinned analysis (a basis object can record the exact Icechunk snapshot it was fitted against, making provenance airtight); time travel for evolving datasets. Harder: read-only in browser (basis persistence to the store routes through the CLI until write support matures); dependency-health watch on icechunk-js. Revisit: Option B if VEDA or Earthmover ship wasm bindings.
