# ADR-0004: All Spectral Math in the Compute Plane; WebGL2 Renders Derived Tiles

**Status:** Accepted (amended v0.2; supersedes the v0.1 fit/apply split)
**Date:** 2026-07-01

## Context

Fit-phase work (streaming covariance, shift-difference noise estimation, Mahalanobis scoring) is reduction-shaped: fragment shaders are hostile to reductions, compute shaders are built for them. The v0.1 draft placed apply-phase work (basis matmul) in the fragment shader, which review finding F1 showed fails twice: per-fragment apply needs full spectral depth resident as textures, and the WebGL2 guaranteed minimum for MAX_ARRAY_TEXTURE_LAYERS is 256, so EMIT (285 bands) and EnMAP (246) do not fit on minimum-spec devices; and the spatial panel renders from the spatial-major pyramid, which carries only a few bands, so the data for a full-basis apply is not present in the display path at all. Browser support remains asymmetric: WebGL2 is universal; WebGPU is broadly shipped but compute maturity varies by platform.

## Decision

The split is not fit-vs-apply but math-vs-display. The compute plane (WebGPU, with identical single-threaded wasm kernels as the transparent fallback tier, surfaced in UI) owns all spectral mathematics: fit reductions and apply projections alike. Apply is a compute pass over spectral-major chunks (storage buffers, no texture-layer limits) that materializes derived product tiles into an in-memory multiscale pyramid keyed by (basis id, level, tile), filling asynchronously and visibly. WebGL2 fragment shaders own all display: wavelength composites of up to ~8 raw bands, and dual-LUT ramping/compositing of derived tiles; the fragment shader never touches full spectral depth. Small dense solves (224 x 224 eigendecomposition, Cholesky) run on CPU wasm regardless: at that size CPU is microseconds and sidesteps GPU numerics variance. Prior art validates both halves: browser WebGPU classification pipelines (DeltaBit-class) for compute, and client-side Zarr WebGL rendering (carbonplan/maps, zarr-gl, OpenLayers GeoZarr) for render.

## Options Considered

**A. WebGL2 everywhere, including per-fragment apply (the v0.1 draft).** Universal floor; rejected on F1: texture-array ceiling breaks EMIT/EnMAP, and the pyramid lacks the bands anyway. Fit via fragment tricks was never viable.

**B. WebGPU everywhere.** Cleanest long-term; raises the floor for basic viewing, and the map-framework integration (deck.gl) is WebGL-first today. Deferred as a later unification.

**C. Math in compute, display in WebGL2 over derived tiles (chosen).** Basic viewing works everywhere; heavy analytics get the right tool where available and a slower honest fallback elsewhere; band count becomes irrelevant to rendering; the fragment shader simplifies to sampling plus ramping.

**D. CPU wasm everywhere.** Simplest; AVIRIS-scale fits become minutes, breaking interactivity goals. Retained only as the fallback tier.

## Consequences

Easier: universal render floor; sensor-independence of the render path (285-band EMIT and 224-band AVIRIS render identically); honest performance tiers; kernels testable headlessly in Node (wasm tier) and via Dawn/wgpu (GPU tier); zoomed-out apply views are exact rather than approximated from pyramid bands; the derived-tile pyramid is a natural future persistence target (committable back to the store as a GeoZarr multiscales product). Harder: apply at a new zoom level is asynchronous (tiles fill in, visibly, consistent with no-invisible-decisions); the derived-tile cache is a new pool under the memory governor; two implementations per kernel (mitigated by generating both from one specification of each reduction where practical). Revisit: unify on WebGPU rendering when deck.gl's WebGPU path and platform compute maturity both land (tracked as deferred in ARCHITECTURE.md Section 10).
