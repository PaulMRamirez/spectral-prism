/**
 * prism-core: shared substrate for spectral-prism and raster-prism.
 *
 * Stage 1 extraction scope (ADR-0006): store abstraction with pluggable request
 * authorization, chunk cache/scheduler, GeoZarr convention reader, memory
 * governor. That work lands under SP-DP requirement IDs during Phase 0; this
 * module is the scaffold anchor until the first extraction commit.
 */
export const PRISM_CORE_STAGE = 1 as const;
