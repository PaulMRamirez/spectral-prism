import * as zarr from 'zarrita';
import { describe, expect, it } from 'vitest';
import { readDualLayoutBinding } from './dual-layout';
import type { StoreReadable } from '../stores/types';

function asReadable(map: Map<string, Uint8Array>): StoreReadable {
  return { get: (key) => Promise.resolve(map.get(key)) };
}

describe('readDualLayoutBinding (unit)', () => {
  it('treats a declared but unreadable layout as absent, with the degraded row', async () => {
    const map = new Map<string, Uint8Array>();
    const root = await zarr.create(map, {
      attributes: {
        'spectral_prism:binding': {
          version: 1,
          spectral: { path: 'ghost' },
          spatial: { path: 'spatial' },
        },
      },
    });
    await zarr.create(root.resolve('spatial'), {
      attributes: { 'proj:code': 'EPSG:3857' },
    });

    const binding = await readDualLayoutBinding(asReadable(map));
    expect(binding?.spectral).toBeNull();
    expect(binding?.spatial?.model.crs?.code).toBe('EPSG:3857');
    expect(binding?.degradations.map((d) => d.row)).toEqual(['single-layout-spatial-only']);
    expect(binding?.degradations[0]?.detail).toContain('"ghost" is not readable');
  });

  it('ignores malformed binding attributes rather than throwing', async () => {
    const map = new Map<string, Uint8Array>();
    await zarr.create(map, {
      attributes: { 'spectral_prism:binding': 'not-an-object' },
    });
    expect(await readDualLayoutBinding(asReadable(map))).toBeNull();
  });

  it('degrades a hostile layout path (SSRF/traversal) instead of following it', async () => {
    const reads: string[] = [];
    const map = new Map<string, Uint8Array>();
    const root = await zarr.create(map, {
      attributes: {
        'spectral_prism:binding': {
          version: 1,
          spectral: { path: '../../secret' },
          spatial: { path: 'http://evil.example/x' },
        },
      },
    });
    await zarr.create(root.resolve('spatial'));

    const watched: StoreReadable = {
      get: (key) => {
        reads.push(key);
        return Promise.resolve(map.get(key));
      },
    };
    const binding = await readDualLayoutBinding(watched);
    expect(binding?.spectral).toBeNull();
    expect(binding?.spatial).toBeNull();
    expect(binding?.degradations.map((d) => d.row)).toEqual(['no-layout-readable']);
    // No read key ever contained a traversal or absolute-URL segment.
    expect(reads.some((k) => k.includes('..') || k.includes('evil.example'))).toBe(false);
  });
});
