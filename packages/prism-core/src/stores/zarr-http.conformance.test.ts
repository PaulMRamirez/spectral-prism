/**
 * Store conformance, SP-DP-001: read Zarr v2, v3, and sharded v3 over real
 * HTTP against fixtures generated independently by zarr-python (see
 * tools/spectral-prism-py/scripts/generate_store_fixtures.py), asserting both
 * decoded values and request mechanics (Range headers, shard coalescing).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as zarr from 'zarrita';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from '../testing/http-fixture-server';
import { createZarrHttpStore, type CoalesceReport } from './zarr-http';

const FIXTURES = join(__dirname, '..', '..', 'fixtures', 'stores');

interface ExpectedArray {
  dtype: string;
  shape: number[];
  values: number[];
}

function loadExpected(name: string): ExpectedArray {
  return JSON.parse(readFileSync(join(FIXTURES, 'expected', `${name}.json`), 'utf8'));
}

let server: FixtureServer;

beforeAll(async () => {
  server = await startFixtureServer(FIXTURES);
});

afterAll(async () => {
  await server.close();
});

/** Requests logged while fn runs, so assertions scope to one read. */
async function logWindow<T>(fn: () => Promise<T>) {
  const from = server.requests.length;
  const result = await fn();
  return { result, requests: server.requests.slice(from) };
}

async function openArray(url: string, path: string) {
  const store = createZarrHttpStore(url);
  const group = await zarr.open(store.readable, { kind: 'group' });
  return zarr.open(group.resolve(path), { kind: 'array' });
}

describe('Zarr v2 over HTTP', () => {
  it('opens the group with attributes via format auto-detection', async () => {
    const store = createZarrHttpStore(`${server.url}/zarr-v2`);
    const group = await zarr.open(store.readable, { kind: 'group' });
    expect(group.attrs['title']).toBe('SP-DP-001 v2 conformance fixture');
  });

  it('decodes an int16 zlib-compressed array to the oracle values', async () => {
    const expected = loadExpected('zarr-v2-reflectance');
    const arr = await openArray(`${server.url}/zarr-v2`, 'reflectance');
    expect(arr.dtype).toBe('int16');
    expect(arr.shape).toEqual(expected.shape);
    const region = await zarr.get(arr);
    expect(region.data).toBeInstanceOf(Int16Array);
    expect([...region.data]).toEqual(expected.values);
  });

  it('decodes the float64 wavelength grid exactly (nm coordinates start in fixtures)', async () => {
    const expected = loadExpected('zarr-v2-wavelengths_nm');
    const arr = await openArray(`${server.url}/zarr-v2`, 'wavelengths_nm');
    const region = await zarr.get(arr);
    expect(region.data).toBeInstanceOf(Float64Array);
    expect([...region.data]).toEqual(expected.values);
  });
});

describe('Zarr v3 over HTTP', () => {
  it('decodes an int16 gzip array to the oracle values', async () => {
    const expected = loadExpected('zarr-v3-reflectance');
    const arr = await openArray(`${server.url}/zarr-v3`, 'reflectance');
    expect(arr.dtype).toBe('int16');
    const region = await zarr.get(arr);
    expect([...region.data]).toEqual(expected.values);
  });

  it('decodes the float64 wavelength grid exactly', async () => {
    const expected = loadExpected('zarr-v3-wavelengths_nm');
    const arr = await openArray(`${server.url}/zarr-v3`, 'wavelengths_nm');
    const region = await zarr.get(arr);
    expect([...region.data]).toEqual(expected.values);
  });
});

describe('Sharded Zarr v3 over HTTP', () => {
  it('decodes the sharded cube to the oracle values', async () => {
    const expected = loadExpected('zarr-v3-sharded-cube');
    const arr = await openArray(`${server.url}/zarr-v3-sharded`, 'cube');
    const region = await zarr.get(arr);
    expect(region.data).toBeInstanceOf(Int16Array);
    expect(region.shape).toEqual(expected.shape);
    expect([...region.data]).toEqual(expected.values);
  });

  it('reads inner chunks with Range requests, coalesced within shards (SP-DP-001 acceptance)', async () => {
    const reports: CoalesceReport[] = [];
    const store = createZarrHttpStore(`${server.url}/zarr-v3-sharded`, {
      coalesce: { onFlush: (r) => reports.push(r) },
    });
    const group = await zarr.open(store.readable, { kind: 'group' });
    const arr = await zarr.open(group.resolve('cube'), { kind: 'array' });

    const { requests } = await logWindow(() => zarr.get(arr));

    // 32 inner chunks live in 8 shard objects. Every shard-object data GET is
    // a ranged request; whole-object GETs would defeat the format. HEAD probes
    // (the shard-index size lookup when suffix ranges are off) are exempt.
    const shardRequests = requests.filter((r) => r.path.includes('/cube/c/'));
    const shardGets = shardRequests.filter((r) => r.method === 'GET');
    expect(shardGets.length).toBeGreaterThan(0);
    expect(shardGets.every((r) => r.range !== null)).toBe(true);

    // Coalescing must fold the four adjacent inner-chunk reads per shard:
    // strictly fewer HTTP requests than the 32 inner chunks.
    expect(shardRequests.length).toBeLessThan(32);

    // The coalescer itself must report folding (more caller reads than fetches).
    const folded = reports.filter((r) => r.requestCount > r.groupCount);
    expect(folded.length).toBeGreaterThan(0);
  });

  it('suffix-range mode reads shard indexes in one request with no HEAD probe', async () => {
    const expected = loadExpected('zarr-v3-sharded-cube');
    const store = createZarrHttpStore(`${server.url}/zarr-v3-sharded`, {
      useSuffixRequest: true,
    });
    const group = await zarr.open(store.readable, { kind: 'group' });
    const arr = await zarr.open(group.resolve('cube'), { kind: 'array' });

    const { result, requests } = await logWindow(() => zarr.get(arr));
    expect([...result.data]).toEqual(expected.values);

    const shardRequests = requests.filter((r) => r.path.includes('/cube/c/'));
    expect(shardRequests.every((r) => r.method === 'GET' && r.range !== null)).toBe(true);
    expect(shardRequests.some((r) => r.range?.startsWith('bytes=-'))).toBe(true);
  });

  it('coalescing reduces request count against the uncoalesced baseline without changing bytes', async () => {
    const expected = loadExpected('zarr-v3-sharded-cube');

    const readAll = async (coalesce: false | Record<string, never>) => {
      const store = createZarrHttpStore(`${server.url}/zarr-v3-sharded`, { coalesce });
      const group = await zarr.open(store.readable, { kind: 'group' });
      const arr = await zarr.open(group.resolve('cube'), { kind: 'array' });
      return logWindow(() => zarr.get(arr));
    };

    const uncoalesced = await readAll(false);
    const coalesced = await readAll({});

    expect([...uncoalesced.result.data]).toEqual(expected.values);
    expect([...coalesced.result.data]).toEqual(expected.values);

    const dataRequests = (requests: typeof server.requests) =>
      requests.filter((r) => r.path.includes('/cube/c/')).length;
    expect(dataRequests(coalesced.requests)).toBeLessThan(dataRequests(uncoalesced.requests));
  });
});

describe('Request authorization hook (smoke; full fixtures land with SP-DP-010)', () => {
  it('applies the hook to metadata and chunk requests alike', async () => {
    const store = createZarrHttpStore(`${server.url}/zarr-v3`, {
      authorize: (req) => {
        req.headers.set('authorization', 'Bearer conformance-token');
        return req;
      },
    });
    const { requests } = await logWindow(async () => {
      const group = await zarr.open(store.readable, { kind: 'group' });
      const arr = await zarr.open(group.resolve('reflectance'), { kind: 'array' });
      return zarr.get(arr);
    });
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every((r) => r.authorization === 'Bearer conformance-token')).toBe(true);
  });
});
