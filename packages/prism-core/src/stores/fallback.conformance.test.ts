/**
 * Store conformance, SP-DP-003: the plain-Zarr HTTP fallback is always
 * functional independent of icechunk-js. icechunk-js is mocked to fail at
 * import (simulating absence); the entire plain-Zarr path, reached through
 * the public barrel so a future static import would break this suite, must
 * stay green, and Icechunk stores must fail with the explicit error the
 * degradation matrix requires, never silently.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as zarr from 'zarrita';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startFixtureServer, type FixtureServer } from '../testing/http-fixture-server';

vi.mock('icechunk-js', () => {
  throw new Error('simulated absence of icechunk-js');
});

const FIXTURES = join(__dirname, '..', '..', 'fixtures', 'stores');

function loadExpected(name: string): { values: number[] } {
  return JSON.parse(readFileSync(join(FIXTURES, 'expected', `${name}.json`), 'utf8'));
}

let server: FixtureServer;

beforeAll(async () => {
  server = await startFixtureServer(FIXTURES);
});

afterAll(async () => {
  await server.close();
});

describe('plain-Zarr fallback with icechunk-js absent', () => {
  it('reads v2, v3, and sharded v3 through the public barrel', async () => {
    const { createZarrHttpStore } = await import('../index');
    for (const [root, path, expected] of [
      ['zarr-v2', 'reflectance', 'zarr-v2-reflectance'],
      ['zarr-v3', 'reflectance', 'zarr-v3-reflectance'],
      ['zarr-v3-sharded', 'cube', 'zarr-v3-sharded-cube'],
    ] as const) {
      const store = createZarrHttpStore(`${server.url}/${root}`);
      const group = await zarr.open(store.readable, { kind: 'group' });
      const arr = await zarr.open(group.resolve(path), { kind: 'array' });
      const region = await zarr.get(arr);
      expect([...region.data], `${root}/${path}`).toEqual(loadExpected(expected).values);
    }
  });

  it('rejects Icechunk stores with an explicit error naming the fallback', async () => {
    const { createIcechunkStore } = await import('../index');
    await expect(createIcechunkStore(`${server.url}/icechunk-native`)).rejects.toThrow(
      /icechunk-js failed to load.*plain Zarr over HTTP remains fully functional/,
    );
  });
});
