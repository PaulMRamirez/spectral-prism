# ADR-0001: Zarr v3 + GeoZarr Conventions as the Native Data Format

**Status:** Accepted
**Date:** 2026-07-01

## Context

Spectral Prism needs a cloud-native format supporting chunk-granular HTTP reads of a (bands, y, x) cube, georeferencing semantics, wavelength coordinates, and multiscale pyramids, all readable in a browser without a server. Raster Prism's COG data plane degrades badly at 224 bands: COGs are spatially chunked per band, so a single spectral probe fans out to up to 224 range requests, and there is no standard home for wavelength/FWHM/bad-band metadata.

## Decision

Zarr v3 (sharded where object counts demand it) with GeoZarr conventions (proj:, spatial:, multiscales, CF coordinate variables) is the native format. COG remains an ingest source, never the native representation.

## Options Considered

**A. COG per band or band-interleaved COG.** Familiar tooling, TiTiler-compatible. Rejected: spectral access pattern is pathological; wavelength semantics live in sidecar conventions nobody agrees on; chunk geometry is not co-designable with GPU tiles.

**B. Zarr v2.** Broadest legacy compatibility. Rejected as primary: no sharding (object-count explosion for small spectral chunks), weaker extension story; still readable via zarrita.

**C. Zarr v3 + GeoZarr (chosen).** Chunk geometry fully controllable; conventions give CRS, geotransform, multiscales, and CF wavelength coordinates as data-carried metadata; OGC standardization in flight (Architecture Board review targeted summer 2026) with implementations across GDAL, rioxarray, OpenLayers, TiTiler; browser readers mature (zarrita.js).

**D. Bespoke format.** Maximum control, zero ecosystem. Rejected on open-source-first grounds.

## Consequences

Easier: probe latency, GPU tile co-design, metadata-carried sensor semantics, ecosystem interop (xarray, GDAL, TiTiler consume the same store). Harder: GeoZarr is pre-1.0, so the convention reader must be versioned and tolerant (isolated in one module); most archival data needs conversion or virtualization (addressed by ADR-0002 and the companion CLI). Revisit: convention namespaces on OGC adoption.
