/**
 * Probe conformance (SP-DP-007 correctness half): extract the full-depth
 * spectrum at a pixel from the spectral-major layout over real HTTP and check
 * it against the committed cube, with wavelengths as nm coordinates and the
 * bad-band mask honored. The latency half is the perf harness (pnpm perf).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as zarr from 'zarrita';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from '../testing/http-fixture-server';
import { createZarrHttpStore } from '../stores/zarr-http';
import { readDualLayoutBinding } from '../binding/dual-layout';
import { scopedReadable } from '../stores/scoped-readable';
import { extractProbeSpectrum } from './spectrum';

const FIXTURES = join(__dirname, '..', '..', 'fixtures', 'stores');

interface Expected {
  spectralPath: string | null;
  spectralCrs: string | null;
}
const bindings: Record<string, Expected> = JSON.parse(
  readFileSync(join(FIXTURES, 'expected', 'dual-layout-bindings.json'), 'utf8'),
);

// The spectral layout is reflectance_ramp(4, 8, 8): value = band*1000 + y*16 + x.
const BANDS = 4;
const HEIGHT = 8;
const WIDTH = 8;
function cubeValue(band: number, y: number, x: number): number {
  return band * 1000 + y * 16 + x;
}

let server: FixtureServer;

beforeAll(async () => {
  server = await startFixtureServer(FIXTURES);
});

afterAll(async () => {
  await server.close();
});

async function openSpectralLayout(fixture: string) {
  const store = createZarrHttpStore(`${server.url}/${fixture}`);
  const binding = await readDualLayoutBinding(store.readable);
  const spectral = binding?.spectral;
  if (!spectral) throw new Error('fixture has no spectral layout');
  const layoutReadable = scopedReadable(store.readable, spectral.path);
  const group = await zarr.open(layoutReadable, { kind: 'group' });
  const array = await zarr.open(group.resolve('cube'), { kind: 'array' });
  return { array, axis: spectral.model.spectral };
}

describe('point-probe spectral extraction over HTTP', () => {
  it('extracts the spectrum at a pixel with wavelengths as nm coordinates', async () => {
    expect(bindings['dual-layout-full']?.spectralPath).toBe('spectral');
    const { array, axis } = await openSpectralLayout('dual-layout-full');
    expect(axis).not.toBeNull();
    if (axis === null) return;

    const y = 3;
    const x = 5;
    const probe = await extractProbeSpectrum(array, axis, y, x);

    expect(probe.wavelengthsNm.length).toBe(BANDS);
    expect(probe.values.length).toBe(BANDS);
    expect([...probe.values]).toEqual(Array.from({ length: BANDS }, (_, b) => cubeValue(b, y, x)));
    // Wavelengths came through as nm, ascending.
    expect([...probe.wavelengthsNm]).toEqual([...axis.wavelengthsNm]);
    expect(probe.mask.every((m) => m === 1)).toBe(true);
  });

  it('extracts corner pixels correctly (chunk-boundary coverage)', async () => {
    const { array, axis } = await openSpectralLayout('dual-layout-full');
    if (axis === null) return;
    for (const [y, x] of [
      [0, 0],
      [HEIGHT - 1, WIDTH - 1],
      [0, WIDTH - 1],
      [HEIGHT - 1, 0],
    ] as const) {
      const probe = await extractProbeSpectrum(array, axis, y, x);
      expect([...probe.values], `pixel ${y},${x}`).toEqual(
        Array.from({ length: BANDS }, (_, b) => cubeValue(b, y, x)),
      );
    }
  });

  it('reads only the bytes for the probed pixel column, not the whole cube', async () => {
    const { array, axis } = await openSpectralLayout('dual-layout-full');
    if (axis === null) return;
    const from = server.requests.length;
    await extractProbeSpectrum(array, axis, 1, 1);
    const chunkReads = server.requests
      .slice(from)
      .filter((r) => r.path.includes('/spectral/cube/c/'));
    // The spectral layout chunks as (4, 4, 4): the pixel column lives in a
    // single chunk on the y/x axes, so at most the band-axis chunk count is
    // touched, never all 8 spatial chunks.
    expect(chunkReads.length).toBeGreaterThan(0);
    expect(chunkReads.length).toBeLessThanOrEqual(2);
  });

  it('masks nodata and bad bands', async () => {
    const { array, axis } = await openSpectralLayout('dual-layout-full');
    if (axis === null) return;
    // Force band 2 to be treated as nodata via the probe option.
    const probe = await extractProbeSpectrum(array, axis, 2, 2, { nodata: cubeValue(2, 2, 2) });
    expect(probe.mask[2]).toBe(0);
    expect(probe.mask[0]).toBe(1);
  });
});
