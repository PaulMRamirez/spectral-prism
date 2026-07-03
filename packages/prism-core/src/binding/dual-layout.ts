/**
 * Dual-layout binding (ADR-0003, ADR-0007, SP-DP-005): one logical dataset
 * binds a spectral-major primary layout (always native CRS) and a
 * spatial-major multiscales pyramid (optionally ingest-warped to a display
 * CRS). The `spectral_prism:binding` attribute records only the pairing,
 * stats-sidecar pointer, and provenance; each layout carries its own standard
 * proj:/spatial:/multiscales conventions (the interop dividend), which is
 * where per-layout CRS comes from. Missing layouts degrade to the matrix
 * rows, never silently.
 */
import * as zarr from 'zarrita';
import { readGeoZarr, type GeoZarrModel } from '../conventions/geozarr';
import { scopedReadable } from '../stores/scoped-readable';
import type { StoreReadable } from '../stores/types';

export const BINDING_ATTRIBUTE = 'spectral_prism:binding';

/** Degradation-matrix rows this binding owns (ARCHITECTURE 9). */
export type BindingDegradation =
  | { row: 'single-layout-spatial-only'; detail: string }
  | { row: 'single-layout-spectral-only'; detail: string }
  | { row: 'no-layout-readable'; detail: string };

export interface LayoutBinding {
  /** Path of the layout group relative to the store root. */
  path: string;
  /** Conventions resolved from the layout group itself (per-layout CRS). */
  model: GeoZarrModel;
}

export interface DualLayoutBinding {
  version: number;
  spectral: LayoutBinding | null;
  spatial: LayoutBinding | null;
  /** Stats sidecar location (consumed by SP-DP-006), when declared. */
  statsPath: string | null;
  /** Opaque provenance carried through from the CLI. */
  provenance: Record<string, unknown> | null;
  degradations: BindingDegradation[];
}

function declaredPath(record: Record<string, unknown>, key: string): string | null {
  const entry = record[key];
  if (typeof entry !== 'object' || entry === null) return null;
  const path = (entry as Record<string, unknown>)['path'];
  return typeof path === 'string' && path.length > 0 ? path : null;
}

async function resolveLayout(readable: StoreReadable, path: string): Promise<LayoutBinding | null> {
  try {
    // scopedReadable refuses unsafe paths (traversal, absolute URLs), so a
    // hostile binding path degrades to an absent layout instead of redirecting
    // reads off the store root or cross-origin (SSRF).
    const model = await readGeoZarr(scopedReadable(readable, path));
    return { path, model };
  } catch {
    // A declared layout that cannot be opened, or whose path is unsafe, is
    // treated as absent; the degradation flag carries the consequence.
    return null;
  }
}

/**
 * Reads the binding from a store's root group. Returns null when the store
 * declares no binding at all (a plain single-array store, handled by the
 * dataset opener); returns a binding with degradation flags when the binding
 * exists but a layout is missing or unopenable.
 */
export async function readDualLayoutBinding(
  readable: StoreReadable,
): Promise<DualLayoutBinding | null> {
  const group = await zarr.open(readable, { kind: 'group' });
  const attr = (group.attrs as Record<string, unknown>)[BINDING_ATTRIBUTE];
  if (typeof attr !== 'object' || attr === null) return null;
  const record = attr as Record<string, unknown>;

  const version = typeof record['version'] === 'number' ? record['version'] : 1;
  const spectralPath = declaredPath(record, 'spectral');
  const spatialPath = declaredPath(record, 'spatial');

  const [spectral, spatial] = await Promise.all([
    spectralPath ? resolveLayout(readable, spectralPath) : Promise.resolve(null),
    spatialPath ? resolveLayout(readable, spatialPath) : Promise.resolve(null),
  ]);

  const degradations: BindingDegradation[] = [];
  if (spectral === null && spatial === null) {
    degradations.push({
      row: 'no-layout-readable',
      detail:
        'the binding declares no layout that could be opened; the dataset cannot be displayed',
    });
  }
  if (spectral === null && spatial !== null) {
    degradations.push({
      row: 'single-layout-spatial-only',
      detail: spectralPath
        ? `declared spectral layout "${spectralPath}" is not readable: probes fan out with a latency warning; fit disabled above the size threshold`
        : 'no spectral layout declared: probes fan out with a latency warning; fit disabled above the size threshold',
    });
  }
  if (spatial === null && spectral !== null) {
    degradations.push({
      row: 'single-layout-spectral-only',
      detail: spatialPath
        ? `declared spatial layout "${spatialPath}" is not readable: map renders from decimated spectral chunks with a quality warning`
        : 'no spatial layout declared: map renders from decimated spectral chunks with a quality warning',
    });
  }

  const stats = declaredPath(record, 'stats');
  const provenance =
    typeof record['provenance'] === 'object' && record['provenance'] !== null
      ? (record['provenance'] as Record<string, unknown>)
      : null;

  return { version, spectral, spatial, statsPath: stats, provenance, degradations };
}
