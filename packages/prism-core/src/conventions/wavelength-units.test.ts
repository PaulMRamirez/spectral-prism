import { describe, expect, it } from 'vitest';
import { nanometersPerUnit, toNanometers } from './wavelength-units';

describe('wavelength unit normalization', () => {
  it('passes nm through unchanged', () => {
    expect([...(toNanometers([450.5, 2310], 'nm') ?? [])]).toEqual([450.5, 2310]);
  });

  it('converts micrometer spellings, including the CF and EMIT forms', () => {
    for (const unit of ['um', 'µm', 'micrometers', 'microns', 'Micrometers']) {
      expect([...(toNanometers([0.4505, 2.31], unit) ?? [])], unit).toEqual([450.5, 2310]);
    }
  });

  it('converts SI meters (the CF canonical length unit)', () => {
    expect(nanometersPerUnit('m')).toBe(1e9);
  });

  it('refuses unrecognized units rather than guessing', () => {
    expect(toNanometers([1, 2], 'cm-1')).toBeNull();
    expect(toNanometers([1, 2], 'GHz')).toBeNull();
    expect(toNanometers([1, 2], '')).toBeNull();
  });

  it('refuses prototype-chain keys from hostile metadata (security regression)', () => {
    for (const unit of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      expect(nanometersPerUnit(unit), unit).toBeNull();
      expect(toNanometers([1], unit), unit).toBeNull();
    }
  });
});
