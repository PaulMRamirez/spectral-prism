import { describe, expect, it } from 'vitest';
import { safeSubpath, scopedReadable } from './scoped-readable';
import type { StoreReadable } from './types';

describe('safeSubpath', () => {
  it('normalizes safe multi-segment paths', () => {
    expect(safeSubpath('spectral')).toBe('spectral');
    expect(safeSubpath('a/b/c')).toBe('a/b/c');
    expect(safeSubpath('level_0/data.zarr')).toBe('level_0/data.zarr');
  });

  it('refuses traversal, absolute, scheme, and empty forms (SSRF vectors)', () => {
    for (const bad of [
      '',
      '..',
      '../other',
      'a/../b',
      '/absolute',
      '//evil.example',
      'http://evil.example/x',
      's3://bucket/key',
      '.',
      'a/./b',
    ]) {
      expect(safeSubpath(bad), bad).toBeNull();
    }
  });
});

describe('scopedReadable', () => {
  it('prefixes keys and forwards extra runtime options (abort signals)', async () => {
    const calls: unknown[][] = [];
    const parent = {
      get: (...args: unknown[]) => {
        calls.push(args);
        return Promise.resolve(undefined);
      },
      getRange: (...args: unknown[]) => {
        calls.push(args);
        return Promise.resolve(undefined);
      },
    } as unknown as Required<StoreReadable>;

    const scoped = scopedReadable(parent, 'spectral');
    const opts = { signal: new AbortController().signal };
    await scoped.get('/zarr.json', ...([opts] as unknown as []));
    await scoped.getRange?.('/c/0', { suffixLength: 4 }, ...([opts] as unknown as []));

    expect(calls[0]).toEqual(['/spectral/zarr.json', opts]);
    expect(calls[1]).toEqual(['/spectral/c/0', { suffixLength: 4 }, opts]);
  });

  it('throws on an unsafe subpath rather than escaping the store root', () => {
    const parent: StoreReadable = { get: () => Promise.resolve(undefined) };
    expect(() => scopedReadable(parent, '../secret')).toThrow(/unsafe store subpath/);
    expect(() => scopedReadable(parent, 'http://evil.example/x')).toThrow(/unsafe store subpath/);
  });

  it('omits getRange when the parent lacks it', () => {
    const parent: StoreReadable = { get: () => Promise.resolve(undefined) };
    expect(scopedReadable(parent, 'x').getRange).toBeUndefined();
  });
});
