/**
 * Store abstraction (ARCHITECTURE 2.1, ADR-0002): one SpectralStore interface,
 * three implementations (ZarrHttpStore, IcechunkStore, LocalStore). The store
 * layer is construction, identity, capability, and request authorization;
 * array reads flow through zarrita against the store's readable. This module
 * is the chunk layer: band indices are legitimate here and nowhere above it.
 */

/** A request about to leave the store layer, exposed for authorization. */
export interface StoreRequest {
  url: URL;
  headers: Headers;
}

/**
 * Pluggable request-authorization hook, accepted by every store (SP-DP-010):
 * static headers, bearer tokens, or pre-signed URL rewriting. The hook may
 * return a new request or mutate and return the given one; the app never owns
 * credential logic itself. Hook authors should scope credentials by
 * request.url.origin: stores are user-supplied URLs, so an unscoped token
 * would be sent to whatever host the user opens.
 */
export type RequestAuthorizer = (request: StoreRequest) => StoreRequest | Promise<StoreRequest>;

export type SpectralStoreKind = 'zarr-http' | 'icechunk' | 'local';

/**
 * Minimal AsyncReadable contract the rest of the data plane consumes
 * (structurally identical to zarrita's, so zarrita open/get functions accept
 * it directly; icechunk-js implements the same shape per ADR-0002).
 */
export type RangeRequest = { offset: number; length: number } | { suffixLength: number };

export interface StoreReadable {
  get(key: `/${string}`): Promise<Uint8Array | undefined>;
  getRange?(key: `/${string}`, range: RangeRequest): Promise<Uint8Array | undefined>;
}

export interface SpectralStore {
  readonly kind: SpectralStoreKind;
  /** Root URL (or synthetic identifier for local stores), for provenance. */
  readonly url: string;
  /** The readable zarrita consumes. */
  readonly readable: StoreReadable;
}
