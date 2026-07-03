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
import {
  chunkCouldMatch,
  computeChunkStats,
  loadChunkStatsSidecar,
  type StatName,
} from './chunk-stats';

const FIXTURES = join(__dirname, '..', '..', 'fixtures', 'stores');

interface Expected {
  dataPath: string;
  statsPath: string;
  shape: number[];
  chunks: number[];
  gridShape: number[];
  nodata: number;
  min: (number | null)[];
  max: (number | null)[];
  sum: number[];
  count: number[];
  cubeValues: number[];
}

const expected: Expected = JSON.parse(
  readFileSync(join(FIXTURES, 'expected', 'stats-sidecar.json'), 'utf8'),
);

/** Expected JSON encodes NaN (all-nodata chunks) as null; map it back. */
function nanFromNull(values: (number | null)[]): number[] {
  return values.map((v) => (v === null ? NaN : v));
}

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
    expect([...(stats?.arrays.min ?? [])]).toEqual(nanFromNull(expected.min));
    expect([...(stats?.arrays.max ?? [])]).toEqual(nanFromNull(expected.max));
    expect([...(stats?.arrays.sum ?? [])]).toEqual(expected.sum);
    expect([...(stats?.arrays.count ?? [])]).toEqual(expected.count);
  });

  it('the on-the-fly fallback matches the sidecar exactly, including nodata seams (SP-DP-006)', async () => {
    // The fixture has an all-nodata chunk and a partially-nodata chunk, so this
    // identity is non-vacuous: fill masking, NaN min/max, and zero counts must
    // agree between the committed sidecar and the on-the-fly computation.
    const store = createZarrHttpStore(`${server.url}/stats-sidecar`);
    const binding = await readDualLayoutBinding(store.readable);
    const sidecar = await loadChunkStatsSidecar(
      store.readable,
      binding?.statsPath as string,
      expected.gridShape,
    );
    const computed = computeChunkStats(expected.cubeValues, expected.shape, expected.chunks, {
      nodata: expected.nodata,
    });
    expect(computed.gridShape).toEqual(expected.gridShape);
    // The fixture actually exercises nodata (an all-fill chunk exists).
    expect([...(computed.arrays.count ?? [])].some((c) => c === 0)).toBe(true);
    expect([...(computed.arrays.min ?? [])].some((m) => Number.isNaN(m))).toBe(true);
    for (const name of ['min', 'max', 'sum', 'count'] as StatName[]) {
      expect([...(sidecar?.arrays[name] ?? [])], name).toEqual([...(computed.arrays[name] ?? [])]);
    }
  });

  it('honors the sidecar skip index via chunkCouldMatch', async () => {
    const store = createZarrHttpStore(`${server.url}/stats-sidecar`);
    const binding = await readDualLayoutBinding(store.readable);
    const stats = await loadChunkStatsSidecar(
      store.readable,
      binding?.statsPath as string,
      expected.gridShape,
    );
    expect(stats).not.toBeNull();
    if (stats === null) return;

    const finiteMaxes = [...(stats.arrays.max ?? [])].filter((m) => Number.isFinite(m));
    const globalFiniteMax = Math.max(...finiteMaxes);

    // A threshold just above the global finite max: every chunk with a finite
    // max is provably skippable; an all-nodata chunk (NaN max) is conservatively
    // kept (never false-skipped).
    for (let i = 0; i < stats.gridShape.reduce((a, b) => a * b, 1); i++) {
      const max = stats.arrays.max?.[i] as number;
      const couldMatch = chunkCouldMatch(stats, i, { atLeast: globalFiniteMax + 1 });
      expect(couldMatch, `chunk ${i} max=${max}`).toBe(!Number.isFinite(max));
    }
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
