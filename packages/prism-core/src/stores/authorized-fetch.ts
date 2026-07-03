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

  // Store traffic is bodiless (GET/HEAD), so method, headers, and signal are
  // the whole request; runs once per chunk fetch, so avoid Request allocation
  // on the string/URL path.
  return async (input, init) => {
    const isRequest = input instanceof Request;
    const authorized = await authorize({
      url: new URL(isRequest ? input.url : input),
      headers: new Headers(init?.headers ?? (isRequest ? input.headers : undefined)),
    });
    const method = init?.method ?? (isRequest ? input.method : undefined);
    const signal = init?.signal ?? (isRequest ? input.signal : undefined);
    return baseFetch(authorized.url, {
      ...init,
      ...(method !== undefined && { method }),
      ...(signal !== undefined && { signal }),
      headers: authorized.headers,
    });
  };
}
