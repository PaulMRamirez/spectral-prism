/**
 * Point-probe spectral extraction (SP-DP-007). The spectral-major layout
 * (bands, y, x) is designed so one object read yields a full local spectrum
 * block (ADR-0003), which is why probe-to-spectrum can hit the 200 ms target.
 * Above the chunk layer wavelength is an nm coordinate (invariant 2): the
 * probe returns wavelengths and values together, never a bare band index.
 */
import * as zarr from 'zarrita';
import type { SpectralAxis } from '../conventions/geozarr';
import type { StoreReadable } from '../stores/types';

export interface ProbeSpectrum {
  /** Pixel probed, in the spectral layout's (y, x) index space. */
  y: number;
  x: number;
  /** Wavelength grid (nm), aligned with values. */
  wavelengthsNm: Float64Array;
  /** Reflectance (or radiance) at the pixel, one per band. */
  values: Float64Array;
  /** 1 = usable band, 0 = bad band, aligned with values; all 1 when unknown. */
  mask: Uint8Array;
}

/** Which axis of the spectral array is the band (spectral) axis. Default 0. */
export interface ProbeOptions {
  bandAxis?: 0 | 1 | 2;
  /** Sentinel treated as no-data: masked out in the returned spectrum. */
  nodata?: number;
}

/**
 * Extracts the full-depth spectrum at pixel (y, x) from an opened spectral
 * array. The selection pins the two spatial axes and takes the whole band
 * axis, so zarrita fetches only the chunk(s) covering that pixel column.
 */
export async function extractProbeSpectrum(
  spectralArray: zarr.Array<zarr.DataType, StoreReadable>,
  axis: SpectralAxis,
  y: number,
  x: number,
  options: ProbeOptions = {},
): Promise<ProbeSpectrum> {
  const { bandAxis = 0, nodata } = options;
  if (spectralArray.shape.length !== 3) {
    throw new Error('probe expects a 3D spectral array (bands, y, x) or a permutation');
  }

  const selection: (number | null)[] = [null, null, null];
  const spatialAxes = [0, 1, 2].filter((a) => a !== bandAxis);
  selection[spatialAxes[0] as number] = y;
  selection[spatialAxes[1] as number] = x;

  // The band axis stays null, so zarrita returns a Chunk (the spectrum vector),
  // fetching only the chunk(s) covering this pixel column.
  const chunk = await zarr.get(spectralArray, selection);
  const raw = chunk.data as ArrayLike<number>;

  const bandCount = spectralArray.shape[bandAxis] as number;
  if (raw.length !== bandCount) {
    throw new Error(`probe returned ${raw.length} samples, expected ${bandCount} bands`);
  }
  if (axis.wavelengthsNm.length !== bandCount) {
    throw new Error(
      `wavelength grid has ${axis.wavelengthsNm.length} entries, spectral axis has ${bandCount} bands`,
    );
  }

  const values = new Float64Array(bandCount);
  const mask = new Uint8Array(bandCount);
  const good = axis.goodBands;
  for (let b = 0; b < bandCount; b++) {
    const v = Number(raw[b]);
    values[b] = v;
    const isGood = good ? good[b] === 1 : true;
    mask[b] = isGood && v !== nodata && !Number.isNaN(v) ? 1 : 0;
  }

  return { y, x, wavelengthsNm: axis.wavelengthsNm, values, mask };
}
