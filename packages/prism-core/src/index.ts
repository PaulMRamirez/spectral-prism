/**
 * prism-core: shared substrate for spectral-prism and raster-prism.
 *
 * Stage 1 extraction scope (ADR-0006): store abstraction with pluggable request
 * authorization, chunk cache/scheduler, GeoZarr convention reader, memory
 * governor. Landing incrementally under SP-DP requirement IDs during Phase 0.
 */
export const PRISM_CORE_STAGE = 1 as const;

export { createAuthorizedFetch } from './stores/authorized-fetch';
export {
  createIcechunkStore,
  type IcechunkRef,
  type IcechunkSpectralStore,
  type IcechunkStoreOptions,
} from './stores/icechunk';
export {
  createZarrHttpStore,
  type CoalesceReport,
  type ZarrHttpStore,
  type ZarrHttpStoreOptions,
} from './stores/zarr-http';
export type {
  RangeRequest,
  RequestAuthorizer,
  SpectralStore,
  SpectralStoreKind,
  StoreReadable,
  StoreRequest,
} from './stores/types';
