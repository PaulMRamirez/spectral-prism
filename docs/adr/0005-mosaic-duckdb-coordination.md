# ADR-0005: Mosaic + DuckDB-WASM as the Coordination and Analytics Layer

**Status:** Accepted
**Date:** 2026-07-01

## Context

Linked spatial-spectral-feature brushing is the differentiating interaction. It requires a selection model that scales to millions of feature-space points, composes set-algebraically, and drives three heterogeneous renderers. Separately, the workbench needs relational storage for probes, region stats, reference libraries, selection sets, and the chunk/stats manifest, plus SQL over all of it (including SAM-in-SQL nearest-library-match for small libraries).

## Decision

DuckDB-WASM holds the relational side; Mosaic (uwdata) coordinates cross-filtering, with each panel as a Mosaic client and brushes compiling to DuckDB predicates. Feature-space samples land as Parquet with row groups aligned to spatial chunk boundaries, keeping spatial queries chunk-coherent. GPU highlighting reads DuckDB selection bitmaps into a mask texture, so brushing never re-uploads pixel data. This deliberately extends the established DuckDB-on-the-analytics-rail pattern (TACIT) onto the interaction path.

## Options Considered

**A. Bespoke selection event bus + in-memory JS structures.** Least dependency weight; reinvents cross-filtering, scales poorly past ~100k points, and leaves the relational needs unserved.

**B. Crossfilter-style libraries.** Purpose-built but capped well below target scale and unmaintained lineage.

**C. Mosaic + DuckDB-WASM (chosen).** Built exactly for scalable coordinated views over DuckDB-WASM; brings the SQL rail for free; healthy academic-plus-OSS maintenance.

**D. Server-side database.** Violates the client-side goal.

## Consequences

Easier: brushing at 1M+ points; probe/library/selection queries in SQL; export (CSV/Parquet) trivially; a future MCP tool surface can reuse the same SQL layer verbatim. Harder: DuckDB-WASM adds ~10 MB to the bundle (lazy-loaded after first render); Mosaic's coordination model constrains custom-renderer integration (each panel implements the Mosaic client contract; a thin adapter for the deck.gl layer and regl renderers). Revisit: DuckDB community Zarr extension codec maturity, which could eventually let DuckDB read chunk data directly for pure-analytics paths.
