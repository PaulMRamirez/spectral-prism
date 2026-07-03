# ADR-0006: prism-core Shared Package; spectral-prism and raster-prism as Consumers

**Status:** Accepted
**Date:** 2026-07-01

## Context

Spectral Prism deliberately inherits Raster Prism concepts (three-panel contract, strategy registry, probe model, fit/apply separability, dual-LUT ramping, overview-fidelity policy) while inverting the primary object. Without a shared substrate, transfer happens by copy and the siblings drift; with an over-shared substrate, spectral-native needs get contorted into raster-shaped abstractions.

## Decision

Extract `prism-core` in two stages (amended v0.2 per review finding F7, avoiding abstraction from a single consumer's shape). **Stage 1 (Phase 0):** only the data-plane core, where both siblings' needs are already demonstrably identical: store abstraction, chunk cache/scheduler, GeoZarr convention reader, and the memory governor. **Stage 2 (end of Phase 2):** the strategy registry contract (fit/apply lifecycle, provenance schema, basis/reference objects), probe and selection models, dual-LUT machinery, and the panel shell/mount pattern, extracted only after spectral-prism's working implementations have shown their real shape against raster-prism's existing ones. Standing rule: core admits an abstraction only after both consumers exhibit it. Spectral-native components (spectral panel, feature-space panel, compute kernels, wavelength semantics) live in spectral-prism until raster-prism demonstrates need. Monorepo (pnpm workspaces), Apache 2.0, conventional commits with package scopes, targeting mission-community-plugins distribution.

## Options Considered

**A. Copy concepts, separate repos.** Fast start; guaranteed drift, and WebGPU/Zarr advances never backport cleanly.

**B. One application with a mode switch.** Maximum sharing; the primary-object inversion becomes a permanent internal argument and both tools get worse.

**C. prism-core monorepo (chosen).** Honest sharing boundary; core changes are reviewed against both consumers; the extraction itself forces the store abstraction Raster Prism needs anyway for its own Zarr future.

## Consequences

Easier: WebGPU compute and the Zarr store abstraction backport to raster-prism through core; embeddable-component packaging (MMGIS/OpenMCT) is solved once; the staged split keeps Phase 0 small and defers the speculative abstractions until evidence exists. Harder: core API changes carry two-consumer review cost; the Stage 1 extraction from the raster-prism codebase is still a real refactor (see ROADMAP.md Phase 0); the interregnum between stages means some temporary duplication of registry/probe code, accepted deliberately. Revisit: whether the spectral panel generalizes into core if raster-prism grows multi-band probes.
