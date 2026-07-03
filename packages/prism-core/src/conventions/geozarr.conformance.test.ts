/**
 * Store conformance, SP-DP-004: the GeoZarr convention reader against
 * committed zarr-python-generated stores over real HTTP, exercising the
 * degradation-matrix rows this reader owns (missing georeferencing; missing
 * wavelengths) as tests, per the REQ acceptance.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from '../testing/http-fixture-server';
import { createZarrHttpStore } from '../stores/zarr-http';
import { readGeoZarr } from './geozarr';

const FIXTURES = join(__dirname, '..', '..', 'fixtures', 'stores');

interface ExpectedModel {
  degradations: string[];
  crsCode: string | null;
  transform: number[] | null;
  multiscalePaths: string[] | null;
  wavelengthsNm: number[] | null;
  fwhmNm: number[] | null;
  goodBands: number[] | null;
}

const expectedModels: Record<string, ExpectedModel> = JSON.parse(
  readFileSync(join(FIXTURES, 'expected', 'geozarr-models.json'), 'utf8'),
);

let server: FixtureServer;

beforeAll(async () => {
  server = await startFixtureServer(FIXTURES);
});

afterAll(async () => {
  await server.close();
});

describe('GeoZarr convention reader over HTTP', () => {
  for (const [fixture, expected] of Object.entries(expectedModels)) {
    it(`resolves ${fixture} to its expected model`, async () => {
      const store = createZarrHttpStore(`${server.url}/${fixture}`);
      const model = await readGeoZarr(store.readable);

      expect(model.degradations.map((d) => d.row).sort()).toEqual(
        [...expected.degradations].sort(),
      );
      expect(model.crs?.code ?? null).toBe(expected.crsCode);
      expect(model.transform?.coefficients ?? null).toEqual(expected.transform);
      expect(model.multiscales?.levels.map((l) => l.path) ?? null).toEqual(
        expected.multiscalePaths,
      );
      expect(model.spectral ? [...model.spectral.wavelengthsNm] : null).toEqual(
        expected.wavelengthsNm,
      );
      expect(model.spectral?.fwhmNm ? [...model.spectral.fwhmNm] : null).toEqual(expected.fwhmNm);
      expect(model.spectral?.goodBands ? [...model.spectral.goodBands] : null).toEqual(
        expected.goodBands,
      );
    });
  }

  it('reads conventions from an Icechunk store the same way (shared readable contract)', async () => {
    // The reader is store-agnostic: the icechunk-native fixture has no
    // conventions, so both matrix rows must flag, never throw.
    const { createIcechunkStore } = await import('../stores/icechunk');
    const store = await createIcechunkStore(`${server.url}/icechunk-native`);
    const model = await readGeoZarr(store.readable);
    expect(model.degradations.map((d) => d.row).sort()).toEqual([
      'missing-georeferencing',
      'missing-wavelengths',
    ]);
  });
});
