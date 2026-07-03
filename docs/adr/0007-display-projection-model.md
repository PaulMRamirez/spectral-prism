# ADR-0007: Display Projection Model (Native-CRS Scene Mode Default; Ingest-Warped Basemap Mode Optional)

**Status:** Accepted
**Date:** 2026-07-01 (added by spec review v0.1, finding F2)

## Context

The v0.1 draft never stated what projection the map renders in. AVIRIS scenes arrive in UTM zones, EMIT in its own grid, and deck.gl's tiling and camera model are Web Mercator-biased. The MMGIS embedding target makes planetary CRS (Mars/Moon equirectangular, polar stereographic, mission-defined proj strings) a first-order requirement. Client-side raster warping is expensive, easy to get subtly wrong, and constitutes silent resampling, which violates design principle 4. Spectroscopists also predominantly inspect scenes pixel-true rather than draped on basemaps.

## Decision

Two explicit display modes; the browser never warps rasters.

1. **Scene mode (default):** render in the dataset's native CRS as a flat scene (deck.gl OrthographicView or equivalent). Pixel-true, no warping, no resampling. Graticule, scale bar, and lat/lon readout are computed by transforming coordinates (proj4js/wasm-proj), which is cheap, rather than pixels, which is not. CRS-agnostic and therefore planetary-safe by construction; also the correct behavior when proj: metadata is absent entirely (pixel coordinates shown, per the degradation matrix).
2. **Basemap mode (optional):** the companion CLI materializes the spatial-major pyramid in a declared display CRS (EPSG:3857 or 4326 for Earth; mission-declared CRS for planetary) at ingest, warping once, with the resampling method recorded per the overview-fidelity policy. The browser consumes the pre-warped pyramid like any other; a basemap underlay becomes available. The spectral-major array always remains in native CRS, so probes, fits, and derived-tile apply are unaffected; binding metadata records the CRS of each layout (ADR-0003 amendment).

## Options Considered

**A. Client-side raster warping.** Maximum flexibility; rejected: GPU warp of every tile is costly, resampling choices become invisible, and correctness at projection edge cases (antimeridian, polar) is a long tail the project should not own.

**B. Web Mercator everywhere.** Simplest deck.gl path; rejected: wrong for planetary bodies, imposes resampling on all Earth data, and forecloses the pixel-true inspection mode scientists want.

**C. Scene mode + ingest-warped basemap mode (chosen).** Warping happens exactly once, server-side, recorded; pixel-true remains the default; planetary works by construction.

## Consequences

Easier: planetary support, correctness (warp code lives in one audited CLI path on GDAL-class libraries), the no-invisible-decisions principle holds for geometry, embedded MMGIS hosts with custom projections receive either mode cleanly. Harder: basemap mode requires ingest-time knowledge of the display CRS (re-run the CLI pyramid step to change it); two viewport models in the spatial panel (one component boundary, mode-switched). Revisit: if deck.gl or MapLibre land robust arbitrary-CRS raster reprojection, client-side warping could become a third opt-in mode.
