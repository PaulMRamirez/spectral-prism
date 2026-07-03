/**
 * Store conformance, SP-DP-010: the pluggable request-authorization hook is
 * exercised in all three modes (static header, bearer token, pre-signed URL
 * rewrite) against an auth-gated fixture server, on every store
 * (ZarrHttpStore and IcechunkStore). Negative path: an unauthorized store
 * surfaces an error, never a blank canvas. Security invariant: an
 * origin-scoped hook does not leak its credential to a foreign virtual-chunk
 * host (the ledgered SP-DP-005 sharp edge).
 */
import { join } from 'node:path';
import * as zarr from 'zarrita';
import { describe, expect, it } from 'vitest';
import { startFixtureServer, type IncomingAuth } from '../testing/http-fixture-server';
import { createZarrHttpStore } from './zarr-http';
import { createIcechunkStore } from './icechunk';
import type { RequestAuthorizer } from './types';

const FIXTURES = join(__dirname, '..', '..', 'fixtures', 'stores');
const VIRTUAL_HOST = 'spectral-prism-fixture.invalid';

const API_KEY = 'fixture-secret-key';
const BEARER = 'fixture-bearer-token';
const SIGNATURE = 'valid-signature';

async function readCube(url: string, authorize: RequestAuthorizer, path = 'reflectance') {
  const store = createZarrHttpStore(url, { authorize });
  const group = await zarr.open(store.readable, { kind: 'group' });
  const arr = await zarr.open(group.resolve(path), { kind: 'array' });
  return zarr.get(arr);
}

describe('SP-DP-010 request authorization on ZarrHttpStore', () => {
  it('header hook: static custom header unlocks a protected endpoint', async () => {
    const server = await startFixtureServer(FIXTURES, {
      requireAuth: (a: IncomingAuth) => a.headers['x-api-key'] === API_KEY,
    });
    try {
      const from = server.requests.length;
      const region = await readCube(`${server.url}/zarr-v3`, (req) => {
        req.headers.set('x-api-key', API_KEY);
        return req;
      });
      expect(region.data.length).toBeGreaterThan(0);
      const requests = server.requests.slice(from);
      expect(requests.length).toBeGreaterThan(0);
      // The hook authorized every request: no 401. (404s are legitimate v2/v3
      // auto-detection probes, not auth failures.)
      expect(requests.every((r) => r.status !== 401)).toBe(true);
    } finally {
      await server.close();
    }
  });

  it('bearer-token hook: Authorization header unlocks the endpoint', async () => {
    const server = await startFixtureServer(FIXTURES, {
      requireAuth: (a) => a.authorization === `Bearer ${BEARER}`,
    });
    try {
      const region = await readCube(`${server.url}/zarr-v3`, (req) => {
        req.headers.set('authorization', `Bearer ${BEARER}`);
        return req;
      });
      expect(region.data.length).toBeGreaterThan(0);
    } finally {
      await server.close();
    }
  });

  it('URL-rewrite hook: pre-signed query parameter unlocks the endpoint', async () => {
    const server = await startFixtureServer(FIXTURES, {
      requireAuth: (a) => a.query.get('sig') === SIGNATURE,
    });
    try {
      const from = server.requests.length;
      const region = await readCube(`${server.url}/zarr-v3`, (req) => {
        req.url.searchParams.set('sig', SIGNATURE);
        return req;
      });
      expect(region.data.length).toBeGreaterThan(0);
      // Metadata and chunk requests all carried the signature: none was
      // rejected with 401. (404s are v2/v3 auto-detection probes.)
      expect(server.requests.slice(from).every((r) => r.status !== 401)).toBe(true);
    } finally {
      await server.close();
    }
  });

  it('no hook against a protected endpoint surfaces an error, never a blank canvas', async () => {
    const server = await startFixtureServer(FIXTURES, {
      requireAuth: (a) => a.authorization === `Bearer ${BEARER}`,
    });
    try {
      const store = createZarrHttpStore(`${server.url}/zarr-v3`);
      await expect(zarr.open(store.readable, { kind: 'group' })).rejects.toThrow(
        /401|Unauthorized/,
      );
    } finally {
      await server.close();
    }
  });
});

describe('SP-DP-010 request authorization on IcechunkStore', () => {
  it('bearer-token hook authorizes repository reads', async () => {
    const server = await startFixtureServer(FIXTURES, {
      requireAuth: (a) => a.authorization === `Bearer ${BEARER}`,
    });
    try {
      const store = await createIcechunkStore(`${server.url}/icechunk-native`, {
        authorize: (req) => {
          req.headers.set('authorization', `Bearer ${BEARER}`);
          return req;
        },
      });
      const group = await zarr.open(store.readable, { kind: 'group' });
      const arr = await zarr.open(group.resolve('cube'), { kind: 'array' });
      expect((await zarr.get(arr)).data.length).toBeGreaterThan(0);
    } finally {
      await server.close();
    }
  });

  it('missing credential on an Icechunk repo surfaces an error', async () => {
    const server = await startFixtureServer(FIXTURES, {
      requireAuth: (a) => a.authorization === `Bearer ${BEARER}`,
    });
    try {
      await expect(createIcechunkStore(`${server.url}/icechunk-native`)).rejects.toThrow();
    } finally {
      await server.close();
    }
  });
});

describe('SP-DP-010 credential does not leak to foreign virtual-chunk hosts', () => {
  it('an origin-scoped hook attaches its token only to the store origin', async () => {
    // Store origin (A) is auth-gated; the "foreign" host (B) stands in for the
    // rewritten virtual-chunk location and records what headers reach it.
    const storeServer = await startFixtureServer(FIXTURES, {
      requireAuth: (a) => a.authorization === `Bearer ${BEARER}`,
    });
    const foreignServer = await startFixtureServer(FIXTURES);
    try {
      const storeOrigin = new URL(storeServer.url).origin;
      // Origin-scoped hook (the documented-correct pattern): token only on the
      // store origin; foreign hosts (virtual refs) get the URL rewrite but no
      // credential.
      const authorize: RequestAuthorizer = (req) => {
        if (req.url.hostname === VIRTUAL_HOST) {
          const live = new URL(foreignServer.url);
          req.url.protocol = live.protocol;
          req.url.host = live.host;
        }
        if (req.url.origin === storeOrigin) {
          req.headers.set('authorization', `Bearer ${BEARER}`);
        }
        return req;
      };

      const store = await createIcechunkStore(`${storeServer.url}/icechunk-virtual`, { authorize });
      const group = await zarr.open(store.readable, { kind: 'group' });
      const arr = await zarr.open(group.resolve('vcube'), { kind: 'array' });
      const region = await zarr.get(arr);
      expect(region.data.length).toBeGreaterThan(0);

      // The store origin saw the bearer token; the foreign host never did.
      expect(storeServer.requests.some((r) => r.authorization === `Bearer ${BEARER}`)).toBe(true);
      const foreignReads = foreignServer.requests.filter((r) => r.path.startsWith('/blobs/'));
      expect(foreignReads.length).toBeGreaterThan(0);
      expect(foreignReads.every((r) => r.authorization === null)).toBe(true);
    } finally {
      await storeServer.close();
      await foreignServer.close();
    }
  });
});
