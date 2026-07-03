import { describe, expect, it } from 'vitest';
import { createAuthorizedFetch } from './authorized-fetch';

function captureFetch() {
  const calls: {
    url: string;
    headers: Headers;
    init: RequestInit | undefined;
    request: Request | undefined;
  }[] = [];
  const stub: typeof fetch = (input, init) => {
    const request = input instanceof Request ? input : undefined;
    const url = input instanceof Request ? input.url : String(input);
    const headers = new Headers(init?.headers ?? request?.headers);
    calls.push({ url, headers, init, request });
    return Promise.resolve(new Response('ok'));
  };
  return { calls, stub };
}

describe('createAuthorizedFetch', () => {
  it('returns the base fetch untouched when no authorizer is configured', () => {
    const { stub } = captureFetch();
    expect(createAuthorizedFetch(undefined, stub)).toBe(stub);
  });

  it('applies header injection (bearer-token style)', async () => {
    const { calls, stub } = captureFetch();
    const fetch = createAuthorizedFetch((req) => {
      req.headers.set('authorization', 'Bearer token-123');
      return req;
    }, stub);
    await fetch('https://data.example/store/zarr.json');
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer token-123');
    expect(calls[0]?.url).toBe('https://data.example/store/zarr.json');
  });

  it('applies URL rewriting (pre-signed style) and preserves range headers', async () => {
    const { calls, stub } = captureFetch();
    const fetch = createAuthorizedFetch((req) => {
      const url = new URL(req.url);
      url.searchParams.set('signature', 'abc');
      return { url, headers: req.headers };
    }, stub);
    await fetch('https://data.example/c/0/0', { headers: { range: 'bytes=0-99' } });
    expect(calls[0]?.url).toBe('https://data.example/c/0/0?signature=abc');
    expect(calls[0]?.headers.get('range')).toBe('bytes=0-99');
  });

  it('supports async authorizers and preserves the abort signal', async () => {
    const { calls, stub } = captureFetch();
    const controller = new AbortController();
    const fetch = createAuthorizedFetch(async (req) => req, stub);
    await fetch('https://data.example/x', { signal: controller.signal });
    expect(calls[0]?.init?.signal).toBe(controller.signal);
  });

  it('preserves Request fields (credentials, cache) when the input is a Request', async () => {
    const { calls, stub } = captureFetch();
    const fetch = createAuthorizedFetch((req) => {
      req.headers.set('authorization', 'Bearer t');
      return req;
    }, stub);
    const source = new Request('https://data.example/c/0', {
      credentials: 'include',
      cache: 'no-store',
      headers: { range: 'bytes=0-9' },
    });
    await fetch(source);
    const sent = calls[0]?.request;
    expect(sent).toBeInstanceOf(Request);
    expect(sent?.credentials).toBe('include');
    expect(sent?.cache).toBe('no-store');
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer t');
    expect(calls[0]?.headers.get('range')).toBe('bytes=0-9');
  });
});
