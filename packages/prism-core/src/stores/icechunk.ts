import type {
  ByteRange,
  RequestOptions as IcechunkRequestOptions,
  Storage as IcechunkStorage,
} from 'icechunk-js';
import { withRangeCoalescing } from 'zarrita';
import { createAuthorizedFetch } from './authorized-fetch';
import type { RequestAuthorizer, SpectralStore } from './types';
import type { CoalesceReport } from './zarr-http';

/**
 * icechunk-js loads lazily at store-open time (SP-DP-003, Q5 posture): the
 * plain-Zarr fallback and the initial bundle never depend on it, and its
 * absence degrades to an explicit error here, never a blank canvas. Type-only
 * imports above are erased at compile time and keep this file out of its
 * runtime graph.
 */
type IcechunkModule = typeof import('icechunk-js');
let icechunkModule: Promise<IcechunkModule> | undefined;

function loadIcechunk(): Promise<IcechunkModule> {
  icechunkModule ??= import('icechunk-js').catch((cause: unknown) => {
    icechunkModule = undefined;
    throw new Error(
      'icechunk-js failed to load, so Icechunk stores are unavailable; plain Zarr over HTTP remains fully functional (SP-DP-003)',
      { cause },
    );
  });
  return icechunkModule;
}

/** Version pin: exactly one ref form; branch main is the default. */
export type IcechunkRef = { branch: string } | { tag: string } | { snapshot: string };

export interface IcechunkStoreOptions {
  /** Ref to pin: branch, tag, or snapshot id (Base32). Default: branch main. */
  ref?: IcechunkRef;
  /**
   * Request-authorization hook (SP-DP-010), applied to repository object
   * reads and virtual chunk fetches alike; URL rewriting here also serves
   * relocatable virtual references.
   */
  authorize?: RequestAuthorizer;
  /** Shard/manifest-aware range coalescing; on by default (ARCHITECTURE 2.6). */
  coalesce?: { coalesceSize?: number; onFlush?: (report: CoalesceReport) => void } | false;
  /**
   * Send If-Match on virtual chunk requests. Off by default: the headers
   * trigger CORS preflight in browsers (icechunk-js default matches).
   */
  validateChecksums?: boolean;
  /** Skip format auto-detection when the repo version is known. */
  formatVersion?: 'v1' | 'v2';
  signal?: AbortSignal;
}

export interface IcechunkSpectralStore extends SpectralStore {
  readonly kind: 'icechunk';
  /** The ref the store was opened at, exactly as requested. */
  readonly ref: IcechunkRef;
  /**
   * Resolved snapshot id (Base32), recorded in every artifact's provenance
   * (SP-DP-002): a basis fitted against this store names the exact snapshot.
   */
  readonly snapshotId: string;
}

/**
 * icechunk-js HttpStorage semantics (GET with Range bytes=start-(end-1),
 * 404 to NotFoundError, other non-2xx to StorageError, HEAD for exists, no
 * listing over HTTP) reimplemented over the store's authorized fetch, since
 * HttpStorage itself only takes static headers.
 */
class AuthorizedHttpStorage implements IcechunkStorage {
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;
  readonly #errors: Pick<IcechunkModule, 'NotFoundError' | 'StorageError'>;

  constructor(
    baseUrl: string,
    authorizedFetch: typeof fetch,
    errors: Pick<IcechunkModule, 'NotFoundError' | 'StorageError'>,
  ) {
    this.#baseUrl = baseUrl.replace(/\/$/, '');
    this.#fetch = authorizedFetch;
    this.#errors = errors;
  }

  #url(path: string): string {
    return `${this.#baseUrl}/${path.startsWith('/') ? path.slice(1) : path}`;
  }

  async getObject(
    path: string,
    range?: ByteRange,
    options?: IcechunkRequestOptions,
  ): Promise<Uint8Array> {
    options?.signal?.throwIfAborted();
    const url = this.#url(path);
    const headers: Record<string, string> = range
      ? { Range: `bytes=${range.start}-${range.end - 1}` }
      : {};
    let response: Response;
    try {
      response = await this.#fetch(url, {
        method: 'GET',
        headers,
        ...(options?.signal && { signal: options.signal }),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error;
      throw new this.#errors.StorageError(
        `Failed to fetch ${url}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined,
      );
    }
    if (response.status === 404) throw new this.#errors.NotFoundError(path);
    if (response.status !== 200 && response.status !== 206) {
      throw new this.#errors.StorageError(
        `HTTP ${response.status} ${response.statusText} for ${url}`,
      );
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  async exists(path: string, options?: IcechunkRequestOptions): Promise<boolean> {
    options?.signal?.throwIfAborted();
    try {
      const response = await this.#fetch(this.#url(path), {
        method: 'HEAD',
        ...(options?.signal && { signal: options.signal }),
      });
      return response.ok;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error;
      return false;
    }
  }

  // eslint-disable-next-line require-yield
  async *listPrefix(_prefix: string): AsyncIterable<string> {
    throw new this.#errors.StorageError(
      'Listing not supported for HTTP storage. Use S3Storage for listing.',
    );
  }
}

/**
 * Icechunk repository over HTTP, read-only, ref-pinned (ADR-0002, SP-DP-002):
 * icechunk-js (pinned exactly, Q5 posture) beneath the SpectralStore face.
 * Plain-Zarr fallback (SP-DP-003) never depends on this module: keep the
 * import graph one-directional.
 */
export async function createIcechunkStore(
  url: string | URL,
  options: IcechunkStoreOptions = {},
): Promise<IcechunkSpectralStore> {
  const {
    ref = { branch: 'main' },
    authorize,
    coalesce = {},
    validateChecksums,
    formatVersion,
    signal,
  } = options;

  const icechunk = await loadIcechunk();
  const authorizedFetch = createAuthorizedFetch(authorize);
  const baseUrl = String(url);
  const storage =
    authorize === undefined
      ? new icechunk.HttpStorage(baseUrl)
      : new AuthorizedHttpStorage(baseUrl, authorizedFetch, icechunk);

  const store = await icechunk.IcechunkStore.open(storage, {
    ...ref,
    ...(coalesce !== false && {
      withRangeCoalescing: (s, opts) => withRangeCoalescing(s, { ...opts, ...coalesce }),
    }),
    fetchClient: { fetch: (chunkUrl, init) => authorizedFetch(chunkUrl, init) },
    ...(validateChecksums !== undefined && { validateChecksums }),
    ...(formatVersion !== undefined && { formatVersion }),
    ...(signal !== undefined && { signal }),
  });

  return {
    kind: 'icechunk',
    url: baseUrl,
    readable: store,
    ref,
    snapshotId: icechunk.encodeObjectId12(store.session.getSnapshotId()),
  };
}
