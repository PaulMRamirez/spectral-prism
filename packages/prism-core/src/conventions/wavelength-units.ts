/**
 * Wavelength unit normalization. Above the chunk layer, wavelength is a nm
 * coordinate, never a bare band index and never a mixed-unit value (design
 * invariant 2); this is the boundary where declared CF units become nm.
 * Unrecognized units are a refusal, not a guess: the caller degrades to the
 * missing-wavelengths matrix row rather than plotting wrong coordinates.
 */

// Null prototype: unit strings come from attacker-controllable store
// metadata, and a plain object literal would answer for inherited keys like
// "constructor", defeating the refusal gate below.
const NM_PER_UNIT: Record<string, number> = Object.assign(Object.create(null), {
  nm: 1,
  nanometer: 1,
  nanometers: 1,
  nanometre: 1,
  nanometres: 1,
  um: 1e3,
  µm: 1e3,
  micrometer: 1e3,
  micrometers: 1e3,
  micrometre: 1e3,
  micrometres: 1e3,
  micron: 1e3,
  microns: 1e3,
  mm: 1e6,
  millimeter: 1e6,
  millimeters: 1e6,
  millimetre: 1e6,
  millimetres: 1e6,
  m: 1e9,
  meter: 1e9,
  meters: 1e9,
  metre: 1e9,
  metres: 1e9,
});

/** nm per one declared unit, or null when the unit is not a length we accept. */
export function nanometersPerUnit(unit: string): number | null {
  return NM_PER_UNIT[unit.trim().toLowerCase()] ?? null;
}

/** Converts declared-unit values to nm; null when the unit is unrecognized. */
export function toNanometers(values: ArrayLike<number>, unit: string): Float64Array | null {
  const factor = nanometersPerUnit(unit);
  if (factor === null) return null;
  const out = new Float64Array(values.length);
  for (let i = 0; i < values.length; i++) out[i] = (values[i] as number) * factor;
  return out;
}
