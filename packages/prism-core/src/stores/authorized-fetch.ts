import type { RequestAuthorizer } from './types';

/**
 * Wraps fetch so every request passes through the store's request-authorization
 * hook before leaving (ARCHITECTURE 2.1): the hook may add headers (tokens) or
 * rewrite the URL (pre-signing). Injected beneath whatever store implementation
 * is in use, so authorization behaves identically across zarr-http, icechunk,
 * and any future readable.
 */
export function createAuthorizedFetch(
  authorize: RequestAuthorizer | undefined,
  baseFetch: typeof fetch = fetch,
): typeof fetch {
  if (authorize === undefined) return baseFetch;

  return async (input, init) => {
    const isRequest = input instanceof Request;
    const authorized = await authorize({
      url: new URL(isRequest ? input.url : input),
      headers: new Headers(init?.headers ?? (isRequest ? input.headers : undefined)),
    });
    // When the caller passed a Request, preserve all of its fields (credentials,
    // cache, redirect, ...) by re-basing on it; only the URL and headers change.
    // A cookie-authenticated store must not lose credentials just because an
    // authorize hook is configured.
    if (isRequest) {
      return baseFetch(new Request(authorized.url, input), { headers: authorized.headers });
    }
    return baseFetch(authorized.url, { ...init, headers: authorized.headers });
  };
}
