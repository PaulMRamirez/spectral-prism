import { FetchStore, withRangeCoalescing } from 'zarrita';
import { createAuthorizedFetch } from './authorized-fetch';
import type { RequestAuthorizer, SpectralStore, StoreReadable } from './types';

/**
 * One coalescer flush: how many caller-level range reads were folded into how
 * many HTTP fetches for one store object. Surfaced for request-mechanics tests
 * and, later, the quiet indicators (no invisible decisions).
 */
export interface CoalesceReport {
  path: string;
  groupCount: number;
  requestCount: number;
  bytesFetched: number;
}

export interface ZarrHttpStoreOptions {
  /** Request-authorization hook applied to every outgoing request (SP-DP-010). */
  authorize?: RequestAuthorizer;
  /**
   * Shard-aware range coalescing (ARCHITECTURE 2.6): adjacent inner-chunk
   * reads within the byte gap threshold merge into one range request. On by
   * default; pass false only in diagnostics.
   */
  coalesce?: { coalesceSize?: number; onFlush?: (report: CoalesceReport) => void } | false;
  /**
   * Read tail-of-object data (shard indexes) with suffix Range requests
   * (bytes=-N, one round trip) instead of HEAD plus offset range (two). Off by
   * default, matching zarrita: not every HTTP host honors suffix ranges.
   */
  useSuffixRequest?: boolean;
}

export interface ZarrHttpStore extends SpectralStore {
  readonly kind: 'zarr-http';
}

/**
 * Plain Zarr v2/v3 over HTTP (ARCHITECTURE 2.1, ADR-0002): zarrita FetchStore
 * beneath the SpectralStore face. Sharded v3 reads flow through getRange and
 * the coalescer. This store is the universal fallback and must always work
 * independent of icechunk-js (SP-DP-003).
 */
export function createZarrHttpStore(
  url: string | URL,
  options: ZarrHttpStoreOptions = {},
): ZarrHttpStore {
  const { authorize, coalesce = {}, useSuffixRequest = false } = options;

  const fetchStore = new FetchStore(String(url), {
    fetch: createAuthorizedFetch(authorize),
    useSuffixRequest,
  });

  const readable: StoreReadable =
    coalesce === false ? fetchStore : withRangeCoalescing(fetchStore, coalesce);

  return {
    kind: 'zarr-http',
    url: String(url),
    readable,
  };
}
