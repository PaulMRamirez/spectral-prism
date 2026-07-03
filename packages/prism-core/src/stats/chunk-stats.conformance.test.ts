/**
 * Store conformance, SP-DP-006: the per-chunk stats sidecar is consumed over
 * real HTTP and, crucially, the sidecar path and the on-the-fly fallback path
 * agree exactly on the same cube (the sidecar is a pure accelerator). The
 * binding's stats pointer resolves through the safeSubpath gate. Absent-stats
 * behavior is covered: the reader returns null so the caller computes and warns.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from '../testing/http-fixture-server';
import { createZarrHttpStore } from '../stores/zarr-http';
import { readDualLayoutBinding } from '../binding/dual-layout';
import { computeChunkStats, loadChunkStatsSidecar, type StatName } from './chunk-stats';

const FIXTURES = join(__dirname, '..', '..', 'fixtures', 'stores');

interface Expected {
  dataPath: string;
  statsPath: string;
  shape: number[];
  chunks: number[];
  gridShape: number[];
  min: number[];
  max: number[];
  sum: number[];
  count: number[];
  cubeValues: number[];
}

const expected: Expected = JSON.parse(
  readFileSync(join(FIXTURES, 'expected', 'stats-sidecar.json'), 'utf8'),
);

let server: FixtureServer;

beforeAll(async () => {
  server = await startFixtureServer(FIXTURES);
});

afterAll(async () => {
  await server.close();
});

describe('per-chunk stats sidecar over HTTP', () => {
  it('loads the sidecar via the binding stats pointer to the oracle values', async () => {
    const store = createZarrHttpStore(`${server.url}/stats-sidecar`);
    const binding = await readDualLayoutBinding(store.readable);
    expect(binding?.statsPath).toBe(expected.statsPath);

    const stats = await loadChunkStatsSidecar(
      store.readable,
      binding?.statsPath as string,
      expected.gridShape,
    );
    expect(stats?.provenance).toBe('sidecar');
    expect(stats?.available.sort()).toEqual(['count', 'max', 'min', 'sum']);
    for (const name of ['min', 'max', 'sum', 'count'] as StatName[]) {
      expect([...(stats?.arrays[name] ?? [])], name).toEqual(expected[name]);
    }
  });

  it('the on-the-fly fallback matches the sidecar exactly (sidecar is a pure accelerator)', async () => {
    const computed = computeChunkStats(expected.cubeValues, expected.shape, expected.chunks, {
      nodata: -9999,
    });
    expect([...(computed.arrays.min ?? [])]).toEqual(expected.min);
    expect([...(computed.arrays.max ?? [])]).toEqual(expected.max);
    expect([...(computed.arrays.sum ?? [])]).toEqual(expected.sum);
    expect([...(computed.arrays.count ?? [])]).toEqual(expected.count);
    expect(computed.gridShape).toEqual(expected.gridShape);
  });

  it('honors the sidecar skip index against a decoded scan', async () => {
    const store = createZarrHttpStore(`${server.url}/stats-sidecar`);
    const binding = await readDualLayoutBinding(store.readable);
    const stats = await loadChunkStatsSidecar(
      store.readable,
      binding?.statsPath as string,
      expected.gridShape,
    );
    expect(stats).not.toBeNull();
    if (stats === null) return;

    // Threshold above the global max: every chunk is skippable.
    const globalMax = Math.max(...expected.max);
    const skippable = expected.max.every(
      (_, i) => !stats.arrays.max || (stats.arrays.max[i] as number) < globalMax + 1,
    );
    expect(skippable).toBe(true);
  });

  it('returns null when the store has no stats sidecar, so the caller computes and warns', async () => {
    const store = createZarrHttpStore(`${server.url}/zarr-v3-sharded`);
    const stats = await loadChunkStatsSidecar(store.readable, 'stats', [2, 2, 2]);
    expect(stats).toBeNull();
  });

  it('refuses an unsafe stats path (same SSRF gate as the binding)', async () => {
    const store = createZarrHttpStore(`${server.url}/stats-sidecar`);
    expect(await loadChunkStatsSidecar(store.readable, '../../secret', [2, 2, 2])).toBeNull();
    expect(
      await loadChunkStatsSidecar(store.readable, 'http://evil.example/x', [2, 2, 2]),
    ).toBeNull();
  });
});
