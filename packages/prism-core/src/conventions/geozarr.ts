/**
 * GeoZarr convention reader (ARCHITECTURE 2.2, ADR-0001, SP-DP-004): resolves
 * zarr_conventions registrations, proj: (CRS), spatial: (affine transform),
 * multiscales, and CF coordinate variables (wavelength in nm, FWHM, bad-band
 * flags) into one typed model. GeoZarr is pre-1.0: every accepted attribute
 * spelling lives in the VOCABULARY table below so spec churn is a table edit,
 * and every absence is an explicit degradation flag (matrix rows, never
 * silent assumptions).
 */
import * as zarr from 'zarrita';
import { toNanometers } from './wavelength-units';
import type { StoreReadable } from '../stores/types';

/** Degradation-matrix rows this reader owns (ARCHITECTURE 9). */
export type ConventionDegradation =
  | { row: 'missing-georeferencing'; detail: string }
  | { row: 'missing-wavelengths'; detail: string };

export interface CrsInfo {
  /** Authority code, e.g. "EPSG:32611", when one was declared. */
  code?: string;
  wkt2?: string;
  projjson?: unknown;
  /** Attribute the value came from (provenance for the UI). */
  source: string;
}

export interface AffineTransform {
  /**
   * Row-major 2D affine [a, b, c, d, e, f]:
   * x_world = a * col + b * row + c; y_world = d * col + e * row + f.
   */
  coefficients: [number, number, number, number, number, number];
  source: string;
}

export interface MultiscaleLevelInfo {
  path: string;
  /** Level metadata as declared; consumers interpret per ADR-0003 spacing. */
  attributes: Record<string, unknown>;
}

export interface MultiscalesInfo {
  levels: MultiscaleLevelInfo[];
  resampling?: string;
  source: string;
}

export interface SpectralAxis {
  wavelengthsNm: Float64Array;
  fwhmNm?: Float64Array;
  /** 1 = usable band, 0 = bad band, aligned with wavelengthsNm. */
  goodBands?: Uint8Array;
  /** Unit string the store declared before normalization to nm. */
  declaredUnit: string;
  source: string;
}

/**
 * A zarr_conventions Convention Metadata Object (array of objects, never
 * strings; uuid is the permanent id, name is recommended). A tolerant reader
 * never requires the declaration: attribute prefixes alone are accepted.
 */
export interface ConventionDeclaration {
  name?: string;
  uuid?: string;
  schemaUrl?: string;
  specUrl?: string;
}

export interface GeoZarrModel {
  /** Registered convention declarations found (zarr_conventions), if any. */
  conventions: ConventionDeclaration[];
  crs: CrsInfo | null;
  transform: AffineTransform | null;
  multiscales: MultiscalesInfo | null;
  spectral: SpectralAxis | null;
  degradations: ConventionDegradation[];
}

/**
 * Accepted attribute spellings per concept, in priority order. Pre-1.0 spec
 * churn is absorbed here; sources and verification in
 * docs/research/geozarr-vocabulary.md. proj: and spatial: follow the modular
 * zarr-conventions v0.1 drafts (proj:code/wkt2/projjson; spatial:transform as
 * number[6] in rasterio Affine order); proj:epsg is accepted as STAC legacy
 * (deprecated 1.2.0, removed 2.0.0).
 */
const VOCABULARY = {
  conventions: ['zarr_conventions'],
  crsCode: ['proj:code'],
  crsEpsgNumeric: ['proj:epsg'],
  crsWkt2: ['proj:wkt2'],
  crsProjjson: ['proj:projjson'],
  transform: ['spatial:transform', 'proj:transform'],
  multiscales: ['multiscales'],
  wavelengthArrayNames: ['wavelengths_nm', 'wavelengths', 'wavelength', 'bands'],
  wavelengthStandardNames: ['radiation_wavelength', 'sensor_band_central_radiation_wavelength'],
  fwhmArrayNames: ['fwhm', 'fwhm_nm'],
  goodBandsArrayNames: ['good_wavelengths', 'good_bands'],
} as const;

type Attrs = Record<string, unknown>;

function firstAttr(attrs: Attrs, keys: readonly string[]): { key: string; value: unknown } | null {
  for (const key of keys) {
    if (attrs[key] !== undefined) return { key, value: attrs[key] };
  }
  return null;
}

function readCrs(attrs: Attrs): CrsInfo | null {
  const code = firstAttr(attrs, VOCABULARY.crsCode);
  const epsg = firstAttr(attrs, VOCABULARY.crsEpsgNumeric);
  const wkt2 = firstAttr(attrs, VOCABULARY.crsWkt2);
  const projjson = firstAttr(attrs, VOCABULARY.crsProjjson);

  const info: CrsInfo = { source: (code ?? epsg ?? wkt2 ?? projjson)?.key ?? '' };
  // Each form is accepted only in its declared type; a wrong-typed attribute
  // (a numeric proj:code, a string proj:epsg) is not a usable CRS and must
  // fall through to the degradation flag, never a hollow CrsInfo (invariant 3).
  if (typeof code?.value === 'string' && /^[^:]+:[^:]+$/.test(code.value)) info.code = code.value;
  else if (typeof epsg?.value === 'number' && Number.isInteger(epsg.value)) {
    info.code = `EPSG:${epsg.value}`;
  }
  if (typeof wkt2?.value === 'string' && wkt2.value.length > 0) info.wkt2 = wkt2.value;
  if (projjson?.value !== null && typeof projjson?.value === 'object') {
    info.projjson = projjson.value;
  }

  if (info.code === undefined && info.wkt2 === undefined && info.projjson === undefined) {
    return null;
  }
  return info;
}

function readTransform(attrs: Attrs): AffineTransform | null {
  const found = firstAttr(attrs, VOCABULARY.transform);
  if (!found || !Array.isArray(found.value)) return null;
  // Every element must be a finite number: coercing null/true/'' to 0/1 would
  // silently fabricate a georeference (invariant 3), and Number('Infinity')
  // would slip past a NaN-only guard.
  if (!found.value.every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
  const raw = found.value as number[];
  // Accept a 6-element affine, or a 9-element row-major homogeneous matrix
  // only when its last row is the identity [0, 0, 1].
  if (raw.length === 9) {
    if (raw[6] !== 0 || raw[7] !== 0 || raw[8] !== 1) return null;
    raw.length = 6;
  }
  if (raw.length !== 6) return null;
  return {
    coefficients: raw as AffineTransform['coefficients'],
    source: found.key,
  };
}

function readMultiscales(attrs: Attrs): MultiscalesInfo | null {
  const found = firstAttr(attrs, VOCABULARY.multiscales);
  if (!found) return null;

  // Primary: multiscales convention v0.1, an object with layout[].asset.
  // Legacy fallback: OME-NGFF-style array with datasets[].path.
  const entry = Array.isArray(found.value) ? found.value[0] : found.value;
  if (typeof entry !== 'object' || entry === null) return null;
  const record = entry as Record<string, unknown>;
  const levels = Array.isArray(record['layout'])
    ? levelsFrom(record['layout'], 'asset')
    : Array.isArray(record['datasets'])
      ? levelsFrom(record['datasets'], 'path')
      : [];
  if (levels.length === 0) return null;
  const info: MultiscalesInfo = { levels, source: found.key };
  if (typeof record['resampling_method'] === 'string')
    info.resampling = record['resampling_method'];
  else if (typeof record['resampling'] === 'string') info.resampling = record['resampling'];
  return info;
}

function levelsFrom(entries: unknown[], pathKey: 'asset' | 'path'): MultiscaleLevelInfo[] {
  const levels: MultiscaleLevelInfo[] = [];
  for (const entry of entries) {
    if (typeof entry === 'object' && entry !== null && pathKey in entry) {
      const { [pathKey]: path, ...attributes } = entry as Record<string, unknown>;
      levels.push({ path: String(path), attributes });
    }
  }
  return levels;
}

async function tryOpenNumericArray(
  group: zarr.Group<StoreReadable>,
  name: string,
): Promise<{ values: Float64Array; attrs: Attrs } | null> {
  let node: zarr.Array<zarr.DataType, StoreReadable>;
  try {
    node = await zarr.open(group.resolve(name), { kind: 'array' });
  } catch {
    return null;
  }
  if (node.shape.length !== 1) return null;
  const chunk = await zarr.get(node);
  const values = new Float64Array(chunk.data.length);
  for (let i = 0; i < values.length; i++) values[i] = Number((chunk.data as ArrayLike<number>)[i]);
  return { values, attrs: node.attrs as Attrs };
}

async function readSpectralAxis(group: zarr.Group<StoreReadable>): Promise<SpectralAxis | null> {
  for (const name of VOCABULARY.wavelengthArrayNames) {
    const found = await tryOpenNumericArray(group, name);
    if (!found) continue;

    const declaredUnit = typeof found.attrs['units'] === 'string' ? found.attrs['units'] : '';
    const standardName = found.attrs['standard_name'];
    const nameSaysNm = name.endsWith('_nm');
    const unit = declaredUnit || (nameSaysNm ? 'nm' : '');
    const wavelengthsNm = toNanometers(found.values, unit);
    if (wavelengthsNm === null) {
      // A candidate array without a usable length unit is not a wavelength
      // axis unless its standard_name vouches for it; refuse rather than guess.
      if (
        typeof standardName !== 'string' ||
        !(VOCABULARY.wavelengthStandardNames as readonly string[]).includes(standardName)
      ) {
        continue;
      }
      return null;
    }

    const axis: SpectralAxis = {
      wavelengthsNm,
      declaredUnit: unit,
      source: name,
    };

    for (const fwhmName of VOCABULARY.fwhmArrayNames) {
      const fwhm = await tryOpenNumericArray(group, fwhmName);
      if (fwhm && fwhm.values.length === wavelengthsNm.length) {
        const fwhmUnit = typeof fwhm.attrs['units'] === 'string' ? fwhm.attrs['units'] : unit;
        const fwhmNm = toNanometers(fwhm.values, fwhmUnit);
        if (fwhmNm) axis.fwhmNm = fwhmNm;
        break;
      }
    }

    for (const goodName of VOCABULARY.goodBandsArrayNames) {
      const good = await tryOpenNumericArray(group, goodName);
      if (good && good.values.length === wavelengthsNm.length) {
        axis.goodBands = Uint8Array.from(good.values, (v) => (v ? 1 : 0));
        break;
      }
    }

    return axis;
  }
  return null;
}

/**
 * Reads the convention model from a store's root group. Never throws on
 * missing conventions: absences become degradation flags the UI must surface.
 */
export async function readGeoZarr(readable: StoreReadable): Promise<GeoZarrModel> {
  const group = await zarr.open(readable, { kind: 'group' });
  const attrs = group.attrs as Attrs;

  const conventionsAttr = firstAttr(attrs, VOCABULARY.conventions);
  const conventions: ConventionDeclaration[] = [];
  if (Array.isArray(conventionsAttr?.value)) {
    for (const entry of conventionsAttr.value) {
      if (typeof entry !== 'object' || entry === null) continue;
      const record = entry as Record<string, unknown>;
      const declaration: ConventionDeclaration = {};
      if (typeof record['name'] === 'string') declaration.name = record['name'];
      if (typeof record['uuid'] === 'string') declaration.uuid = record['uuid'];
      if (typeof record['schema_url'] === 'string') declaration.schemaUrl = record['schema_url'];
      if (typeof record['spec_url'] === 'string') declaration.specUrl = record['spec_url'];
      if (Object.keys(declaration).length > 0) conventions.push(declaration);
    }
  }

  const crs = readCrs(attrs);
  const transform = readTransform(attrs);
  const multiscales = readMultiscales(attrs);
  const spectral = await readSpectralAxis(group);

  const degradations: ConventionDegradation[] = [];
  if (crs === null || transform === null) {
    degradations.push({
      row: 'missing-georeferencing',
      detail:
        crs === null && transform === null
          ? 'no proj: or spatial: conventions found'
          : crs === null
            ? 'CRS missing (spatial transform present)'
            : 'spatial transform missing (CRS present)',
    });
  }
  if (spectral === null) {
    degradations.push({
      row: 'missing-wavelengths',
      detail: 'no wavelength coordinate with a usable length unit found',
    });
  }

  return { conventions, crs, transform, multiscales, spectral, degradations };
}
