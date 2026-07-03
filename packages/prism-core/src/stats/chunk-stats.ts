/**
 * Per-chunk statistics (ADR-0003, ARCHITECTURE 2.4, SP-DP-006). The sidecar is
 * a group of per-chunk scalar arrays whose shape equals the data array's chunk
 * grid, one array per statistic (min/max/sum/count, with percentiles and the
 * spectral extensions optional). Its purpose is the skip index: a strategy
 * scan skips a chunk whose stat envelope cannot contain a hit, without fetching
 * it (zone-map pruning). When the sidecar is absent, stats are computed on the
 * fly and a warning is surfaced (degradation matrix), never a silent
 * assumption. The sidecar is a read-time accelerator: absent or partial, the
 * result is identical, only slower.
 *
 * "ZEP0005-aligned" (ADR-0003) means aligned in spirit, not a ratified wire
 * format: ZEP0005 is a stale draft about chunk cumulative sums, and no per-
 * chunk statistics convention exists in zarr-conventions as of 2026-07 (see
 * docs/research/zep0005-stats-posture.md). This layout is therefore a
 * spectral-prism convention: it carries an explicit STATS_VERSION and is read
 * through this one adapter, so a future zarr-conventions statistics convention
 * can be added as another dialect without touching consumers. Unknown sidecar
 * attributes are ignored, never fatal.
 */
import * as zarr from 'zarrita';
import { safeSubpath, scopedReadable } from '../stores/scoped-readable';
import type { StoreReadable } from '../stores/types';

/** Statistic names this dialect reads; extensions are tolerated but not required. */
export const STAT_NAMES = ['min', 'max', 'sum', 'count'] as const;
export type StatName = (typeof STAT_NAMES)[number];

/** Sidecar dialect version, carried in the stats group under spectral_prism:. */
export const STATS_VERSION = 1 as const;

export interface ChunkStats {
  /** Chunk-grid shape (number of chunks per axis), matching the data array. */
  gridShape: number[];
  /** Statistic name to its per-chunk flat array (C-order over the chunk grid). */
  arrays: Partial<Record<StatName, Float64Array>>;
  /** Provenance: how these numbers were obtained (no invisible decisions). */
  provenance: 'sidecar' | 'computed';
  /** Which statistics are actually present (a sidecar may be partial). */
  available: StatName[];
}

/** Row-major (C-order) flat index of a chunk coordinate within the grid. */
export function chunkGridIndex(gridShape: number[], coord: number[]): number {
  if (coord.length !== gridShape.length) {
    throw new RangeError('chunk coordinate rank does not match the grid');
  }
  let index = 0;
  for (let axis = 0; axis < gridShape.length; axis++) {
    const c = coord[axis] as number;
    const extent = gridShape[axis] as number;
    if (c < 0 || c >= extent) throw new RangeError(`chunk coordinate out of range on axis ${axis}`);
    index = index * extent + c;
  }
  return index;
}

/** Number of chunks along each axis for a shape/chunk pair. */
export function chunkGridShape(shape: number[], chunks: number[]): number[] {
  return shape.map((s, i) => Math.ceil(s / (chunks[i] as number)));
}

async function readStatArray(
  statsGroup: zarr.Group<StoreReadable>,
  name: StatName,
): Promise<Float64Array | null> {
  try {
    const arr = await zarr.open(statsGroup.resolve(name), { kind: 'array' });
    const chunk = await zarr.get(arr);
    return Float64Array.from(chunk.data as ArrayLike<number>, Number);
  } catch {
    return null;
  }
}

/**
 * Loads the per-chunk stats sidecar at the given store-relative path. Returns
 * null when the sidecar is absent or its path is unsafe, so the caller falls
 * back to on-the-fly computation. A sidecar present but missing some statistics
 * loads partially: `available` names what can be trusted.
 */
export async function loadChunkStatsSidecar(
  readable: StoreReadable,
  statsPath: string,
  gridShape: number[],
): Promise<ChunkStats | null> {
  if (safeSubpath(statsPath) === null) return null;
  let statsGroup: zarr.Group<StoreReadable>;
  try {
    statsGroup = await zarr.open(scopedReadable(readable, statsPath), { kind: 'group' });
  } catch {
    return null;
  }

  const expected = gridShape.reduce((a, b) => a * b, 1);
  const arrays: Partial<Record<StatName, Float64Array>> = {};
  const available: StatName[] = [];
  for (const name of STAT_NAMES) {
    const values = await readStatArray(statsGroup, name);
    // A stat array whose length does not match the grid is not trustworthy;
    // drop it rather than misalign the skip index.
    if (values !== null && values.length === expected) {
      arrays[name] = values;
      available.push(name);
    }
  }

  if (available.length === 0) return null;
  return { gridShape, arrays, provenance: 'sidecar', available };
}

export interface ThresholdQuery {
  /** Keep chunks whose values could be >= this. Compared against per-chunk max. */
  atLeast?: number;
  /** Keep chunks whose values could be <= this. Compared against per-chunk min. */
  atMost?: number;
}

/**
 * Skip index: given per-chunk min/max, returns whether a chunk's value range
 * could satisfy the query, so a scan can skip fetching it. Conservative: a
 * chunk is skippable only when a required statistic is present and rules it
 * out; missing stats mean "cannot skip" (fetch it), never a false skip.
 */
export function chunkCouldMatch(
  stats: ChunkStats,
  chunkIndex: number,
  query: ThresholdQuery,
): boolean {
  if (query.atLeast !== undefined) {
    const max = stats.arrays.max?.[chunkIndex];
    if (max !== undefined && max < query.atLeast) return false;
  }
  if (query.atMost !== undefined) {
    const min = stats.arrays.min?.[chunkIndex];
    if (min !== undefined && min > query.atMost) return false;
  }
  return true;
}

/**
 * On-the-fly per-chunk statistics: computes min/max/sum/count over an
 * already-decoded array by iterating its chunk grid. This is the fallback when
 * no sidecar exists; it produces the same ChunkStats shape marked
 * provenance 'computed', and honors a nodata sentinel (never counted, ADR-0003
 * "nodata defined once and respected").
 */
export function computeChunkStats(
  data: ArrayLike<number>,
  shape: number[],
  chunks: number[],
  options: { nodata?: number } = {},
): ChunkStats {
  const gridShape = chunkGridShape(shape, chunks);
  const chunkCount = gridShape.reduce((a, b) => a * b, 1);
  const min = new Float64Array(chunkCount).fill(Number.POSITIVE_INFINITY);
  const max = new Float64Array(chunkCount).fill(Number.NEGATIVE_INFINITY);
  const sum = new Float64Array(chunkCount);
  const count = new Float64Array(chunkCount);
  const { nodata } = options;

  const strides = new Array<number>(shape.length);
  strides[shape.length - 1] = 1;
  for (let axis = shape.length - 2; axis >= 0; axis--) {
    strides[axis] = (strides[axis + 1] as number) * (shape[axis + 1] as number);
  }

  const coord = new Array<number>(shape.length).fill(0);
  const total = shape.reduce((a, b) => a * b, 1);
  const chunkCoord = new Array<number>(shape.length);
  for (let flat = 0; flat < total; flat++) {
    let remainder = flat;
    for (let axis = 0; axis < shape.length; axis++) {
      coord[axis] = Math.floor(remainder / (strides[axis] as number));
      remainder -= (coord[axis] as number) * (strides[axis] as number);
      chunkCoord[axis] = Math.floor((coord[axis] as number) / (chunks[axis] as number));
    }
    const value = data[flat] as number;
    if (value === nodata || Number.isNaN(value)) continue;
    const ci = chunkGridIndex(gridShape, chunkCoord);
    if (value < (min[ci] as number)) min[ci] = value;
    if (value > (max[ci] as number)) max[ci] = value;
    sum[ci] = (sum[ci] as number) + value;
    count[ci] = (count[ci] as number) + 1;
  }

  // Chunks that were entirely nodata report NaN min/max rather than +/-Inf.
  for (let ci = 0; ci < chunkCount; ci++) {
    if (count[ci] === 0) {
      min[ci] = NaN;
      max[ci] = NaN;
    }
  }

  return {
    gridShape,
    arrays: { min, max, sum, count },
    provenance: 'computed',
    available: [...STAT_NAMES],
  };
}
