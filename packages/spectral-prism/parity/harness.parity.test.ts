/**
 * Parity-harness skeleton (pnpm test:parity, CI kernel-parity step). Proves the
 * fixture-load-and-compare plumbing ahead of the real kernel suites; oracle
 * fixtures and cross-tier comparisons land with SP-CP-001/005 in Phase 2.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compareWithTolerance } from '../src/compute/tolerance';

interface ParityFixture {
  description: string;
  wavelengthsNm: number[];
  values: number[];
}

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/synthetic-reflectance.json', import.meta.url), 'utf8'),
) as ParityFixture;

describe('parity harness skeleton', () => {
  it('loads a committed fixture with wavelengths as nm coordinates', () => {
    expect(fixture.wavelengthsNm).toHaveLength(fixture.values.length);
    expect(fixture.wavelengthsNm.every((nm) => nm > 350 && nm < 2600)).toBe(true);
  });

  it('compares a tier output to the oracle within ADR-0008 style tolerances', () => {
    const tierOutput = fixture.values.map((v) => v + v * 1e-9);
    const report = compareWithTolerance(tierOutput, fixture.values, { rtol: 1e-7, atol: 1e-12 });
    expect(report.pass).toBe(true);
    expect(report.compared).toBe(fixture.values.length);
  });

  it('detects an out-of-tolerance tier, so a real regression cannot pass silently', () => {
    const broken = fixture.values.map((v, i) => (i === 3 ? v + 0.01 : v));
    const report = compareWithTolerance(broken, fixture.values, { rtol: 1e-7, atol: 1e-12 });
    expect(report.pass).toBe(false);
    expect(report.firstFailureIndex).toBe(3);
  });
});
