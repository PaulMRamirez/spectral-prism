/**
 * Reader-logic unit tests over in-memory stores (vocabulary-independent
 * behavior: degradation flags, unit normalization, coercions, refusals).
 * The committed zarr-python conformance fixtures pin the real on-disk
 * vocabulary separately (geozarr.conformance.test.ts).
 */
import * as zarr from 'zarrita';
import { describe, expect, it } from 'vitest';
import { readGeoZarr } from './geozarr';
import type { StoreReadable } from '../stores/types';

type MemStore = Map<string, Uint8Array>;

function asReadable(map: MemStore): StoreReadable {
  return { get: (key) => Promise.resolve(map.get(key)) };
}

async function makeGroup(attributes: Record<string, unknown>): Promise<{
  map: MemStore;
  root: zarr.Group<MemStore>;
}> {
  const map: MemStore = new Map();
  const root = await zarr.create(map, { attributes });
  return { map, root };
}

async function addArray(
  root: zarr.Group<MemStore>,
  name: string,
  values: number[],
  attributes: Record<string, unknown> = {},
): Promise<void> {
  const arr = await zarr.create(root.resolve(name), {
    shape: [values.length],
    chunkShape: [values.length],
    dtype: 'float64',
    attributes,
  });
  await zarr.set(arr, null, {
    data: Float64Array.from(values),
    shape: [values.length],
    stride: [1],
  });
}

const GEOREF = {
  'proj:code': 'EPSG:32611',
  'spatial:transform': [30, 0, 499980, 0, -30, 3800040],
};

describe('readGeoZarr', () => {
  it('reads the full model with no degradations', async () => {
    const { map, root } = await makeGroup({
      zarr_conventions: [
        { name: 'proj', uuid: 'f17cb550-5864-4468-aeb7-f3180cfb622f' },
        { name: 'spatial', uuid: '689b58e2-cf7b-45e0-9fff-9cfc0883d6b4' },
      ],
      ...GEOREF,
      multiscales: {
        layout: [{ asset: '0' }, { asset: '1', derived_from: '0' }],
        resampling_method: 'average',
      },
    });
    await addArray(root, 'wavelengths', [450.5, 550.25, 650, 850], { units: 'nm' });
    await addArray(root, 'fwhm', [5, 5, 6, 6], { units: 'nm' });
    await addArray(root, 'good_wavelengths', [1, 1, 0, 1]);

    const model = await readGeoZarr(asReadable(map));
    expect(model.degradations).toEqual([]);
    expect(model.conventions).toEqual([
      { name: 'proj', uuid: 'f17cb550-5864-4468-aeb7-f3180cfb622f' },
      { name: 'spatial', uuid: '689b58e2-cf7b-45e0-9fff-9cfc0883d6b4' },
    ]);
    expect(model.crs?.code).toBe('EPSG:32611');
    expect(model.transform?.coefficients).toEqual([30, 0, 499980, 0, -30, 3800040]);
    expect(model.multiscales?.levels.map((l) => l.path)).toEqual(['0', '1']);
    expect(model.multiscales?.resampling).toBe('average');
    expect([...(model.spectral?.wavelengthsNm ?? [])]).toEqual([450.5, 550.25, 650, 850]);
    expect([...(model.spectral?.fwhmNm ?? [])]).toEqual([5, 5, 6, 6]);
    expect([...(model.spectral?.goodBands ?? [])]).toEqual([1, 1, 0, 1]);
  });

  it('accepts the legacy OME-style multiscales form (datasets/path) read-only', async () => {
    const { map, root } = await makeGroup({
      ...GEOREF,
      multiscales: [{ datasets: [{ path: '0' }, { path: '1' }], resampling: 'nearest' }],
    });
    await addArray(root, 'wavelengths', [450], { units: 'nm' });
    const model = await readGeoZarr(asReadable(map));
    expect(model.multiscales?.levels.map((l) => l.path)).toEqual(['0', '1']);
    expect(model.multiscales?.resampling).toBe('nearest');
  });

  it('normalizes micrometer wavelengths and FWHM to nm', async () => {
    const { map, root } = await makeGroup(GEOREF);
    await addArray(root, 'wavelengths', [0.4505, 2.31], { units: 'um' });
    await addArray(root, 'fwhm', [0.005, 0.006], { units: 'um' });
    const model = await readGeoZarr(asReadable(map));
    expect([...(model.spectral?.wavelengthsNm ?? [])]).toEqual([450.5, 2310]);
    expect([...(model.spectral?.fwhmNm ?? [])]).toEqual([5, 6]);
    expect(model.spectral?.declaredUnit).toBe('um');
  });

  it('coerces numeric proj:epsg and truncates a 9-element homogeneous transform', async () => {
    const { map, root } = await makeGroup({
      'proj:epsg': 32611,
      'spatial:transform': [30, 0, 499980, 0, -30, 3800040, 0, 0, 1],
    });
    await addArray(root, 'wavelengths', [450], { units: 'nm' });
    const model = await readGeoZarr(asReadable(map));
    expect(model.crs?.code).toBe('EPSG:32611');
    expect(model.transform?.coefficients).toEqual([30, 0, 499980, 0, -30, 3800040]);
  });

  it('rejects a 9-element transform whose last row is not the identity', async () => {
    const { map, root } = await makeGroup({
      'proj:code': 'EPSG:32611',
      'spatial:transform': [30, 0, 499980, 0, -30, 3800040, 2, 0, 1],
    });
    await addArray(root, 'wavelengths', [450], { units: 'nm' });
    const model = await readGeoZarr(asReadable(map));
    expect(model.transform).toBeNull();
    expect(model.degradations[0]?.detail).toContain('transform missing');
  });

  it('refuses a transform with non-finite elements rather than coercing (invariant 3)', async () => {
    for (const bad of [
      [30, 0, null, 0, -30, 3800040],
      [true, '', '30', [], 0, 1],
      [30, 0, 'Infinity', 0, -30, 0],
    ]) {
      const { map, root } = await makeGroup({
        'proj:code': 'EPSG:32611',
        'spatial:transform': bad,
      });
      await addArray(root, 'wavelengths', [450], { units: 'nm' });
      const model = await readGeoZarr(asReadable(map));
      expect(model.transform, JSON.stringify(bad)).toBeNull();
      expect(model.degradations.map((d) => d.row)).toContain('missing-georeferencing');
    }
  });

  it('refuses a wrong-typed CRS attribute rather than returning a hollow CrsInfo (invariant 3)', async () => {
    for (const attrs of [
      { 'proj:code': 32611 }, // number, not authority:code string
      { 'proj:epsg': '32611' }, // string, not a number
      { 'proj:code': 'no-colon' }, // not authority:code shaped
    ]) {
      const { map, root } = await makeGroup(attrs);
      await addArray(root, 'wavelengths', [450], { units: 'nm' });
      const model = await readGeoZarr(asReadable(map));
      expect(model.crs, JSON.stringify(attrs)).toBeNull();
      expect(model.degradations.map((d) => d.row)).toContain('missing-georeferencing');
    }
  });

  it('flags missing georeferencing as the matrix row, with detail', async () => {
    const { map, root } = await makeGroup({});
    await addArray(root, 'wavelengths', [450], { units: 'nm' });
    const model = await readGeoZarr(asReadable(map));
    expect(model.crs).toBeNull();
    expect(model.degradations).toEqual([
      { row: 'missing-georeferencing', detail: 'no proj: or spatial: conventions found' },
    ]);
  });

  it('flags a partial georeference (CRS without transform) rather than passing it', async () => {
    const { map, root } = await makeGroup({ 'proj:code': 'EPSG:4326' });
    await addArray(root, 'wavelengths', [450], { units: 'nm' });
    const model = await readGeoZarr(asReadable(map));
    expect(model.crs?.code).toBe('EPSG:4326');
    expect(model.degradations.map((d) => d.row)).toEqual(['missing-georeferencing']);
    expect(model.degradations[0]?.detail).toContain('transform missing');
  });

  it('flags missing wavelengths as the matrix row', async () => {
    const { map } = await makeGroup(GEOREF);
    const model = await readGeoZarr(asReadable(map));
    expect(model.spectral).toBeNull();
    expect(model.degradations.map((d) => d.row)).toEqual(['missing-wavelengths']);
  });

  it('refuses a wavelength candidate with a non-length unit rather than guessing', async () => {
    const { map, root } = await makeGroup(GEOREF);
    await addArray(root, 'wavelengths', [1, 2, 3], { units: 'GHz' });
    const model = await readGeoZarr(asReadable(map));
    expect(model.spectral).toBeNull();
    expect(model.degradations.map((d) => d.row)).toEqual(['missing-wavelengths']);
  });

  it('trusts a _nm-suffixed array name when units are absent', async () => {
    const { map, root } = await makeGroup(GEOREF);
    await addArray(root, 'wavelengths_nm', [450.5, 850]);
    const model = await readGeoZarr(asReadable(map));
    expect([...(model.spectral?.wavelengthsNm ?? [])]).toEqual([450.5, 850]);
  });
});
