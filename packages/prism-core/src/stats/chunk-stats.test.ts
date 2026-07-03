import { describe, expect, it } from 'vitest';
import {
  chunkCouldMatch,
  chunkGridIndex,
  chunkGridShape,
  computeChunkStats,
  type ChunkStats,
} from './chunk-stats';

describe('chunk grid helpers', () => {
  it('computes the chunk-grid shape with ceil division', () => {
    expect(chunkGridShape([8, 8], [4, 4])).toEqual([2, 2]);
    expect(chunkGridShape([10, 7], [4, 4])).toEqual([3, 2]);
  });

  it('maps chunk coordinates to C-order flat indices', () => {
    expect(chunkGridIndex([2, 2], [0, 0])).toBe(0);
    expect(chunkGridIndex([2, 2], [1, 0])).toBe(2);
    expect(chunkGridIndex([2, 2], [1, 1])).toBe(3);
  });

  it('throws on out-of-range or mis-ranked coordinates', () => {
    expect(() => chunkGridIndex([2, 2], [2, 0])).toThrow(RangeError);
    expect(() => chunkGridIndex([2, 2], [0])).toThrow(RangeError);
  });
});

describe('computeChunkStats', () => {
  // 4x4 array, 2x2 chunks -> a 2x2 chunk grid. Values are row-major.
  const shape = [4, 4];
  const chunks = [2, 2];
  // Each 2x2 chunk gets a distinct value band so per-chunk min/max are obvious.
  const data = [0, 1, 10, 11, 2, 3, 12, 13, 20, 21, 30, 31, 22, 23, 32, 33];

  it('computes per-chunk min/max/sum/count over the chunk grid', () => {
    const stats = computeChunkStats(data, shape, chunks);
    expect(stats.provenance).toBe('computed');
    expect(stats.gridShape).toEqual([2, 2]);
    // Top-left chunk holds 0,1,2,3.
    expect(stats.arrays.min?.[0]).toBe(0);
    expect(stats.arrays.max?.[0]).toBe(3);
    expect(stats.arrays.sum?.[0]).toBe(6);
    expect(stats.arrays.count?.[0]).toBe(4);
    // Bottom-right chunk holds 30,31,32,33.
    expect(stats.arrays.min?.[3]).toBe(30);
    expect(stats.arrays.max?.[3]).toBe(33);
  });

  it('excludes a nodata sentinel from every statistic', () => {
    const withNodata = data.map((v) => (v === 0 ? -9999 : v));
    const stats = computeChunkStats(withNodata, shape, chunks, { nodata: -9999 });
    expect(stats.arrays.min?.[0]).toBe(1);
    expect(stats.arrays.count?.[0]).toBe(3);
    expect(stats.arrays.sum?.[0]).toBe(6);
  });

  it('reports NaN min/max for an all-nodata chunk rather than +/-Infinity', () => {
    const allFill = new Array(16).fill(-9999);
    const stats = computeChunkStats(allFill, shape, chunks, { nodata: -9999 });
    expect(stats.arrays.count?.[0]).toBe(0);
    expect(Number.isNaN(stats.arrays.min?.[0] as number)).toBe(true);
    expect(Number.isNaN(stats.arrays.max?.[0] as number)).toBe(true);
  });
});

describe('chunkCouldMatch (skip index)', () => {
  const stats: ChunkStats = {
    gridShape: [2],
    arrays: { min: Float64Array.from([0, 100]), max: Float64Array.from([10, 110]) },
    provenance: 'sidecar',
    available: ['min', 'max'],
  };

  it('skips a chunk whose max rules out an atLeast threshold', () => {
    expect(chunkCouldMatch(stats, 0, { atLeast: 50 })).toBe(false);
    expect(chunkCouldMatch(stats, 1, { atLeast: 50 })).toBe(true);
  });

  it('skips a chunk whose min rules out an atMost threshold', () => {
    expect(chunkCouldMatch(stats, 1, { atMost: 50 })).toBe(false);
    expect(chunkCouldMatch(stats, 0, { atMost: 50 })).toBe(true);
  });

  it('never false-skips when the needed statistic is absent', () => {
    const min = stats.arrays.min as Float64Array;
    const noMax: ChunkStats = {
      gridShape: stats.gridShape,
      arrays: { min },
      provenance: 'sidecar',
      available: ['min'],
    };
    expect(chunkCouldMatch(noMax, 0, { atLeast: 50 })).toBe(true);
  });
});
