import { describe, expect, it } from 'vitest';
import { compareWithTolerance } from './tolerance';

const TIGHT = { rtol: 1e-7, atol: 1e-12 };

describe('compareWithTolerance', () => {
  it('passes identical arrays', () => {
    const values = [0.042, 0.31, 0.87, 0];
    const report = compareWithTolerance(values, values, TIGHT);
    expect(report.pass).toBe(true);
    expect(report.compared).toBe(4);
    expect(report.failures).toBe(0);
  });

  it('fails a perturbation beyond tolerance and reports where', () => {
    const expected = [0.042, 0.31, 0.87];
    const actual = [0.042, 0.31 + 1e-3, 0.87];
    const report = compareWithTolerance(actual, expected, { rtol: 1e-6, atol: 1e-12 });
    expect(report.pass).toBe(false);
    expect(report.failures).toBe(1);
    expect(report.firstFailureIndex).toBe(1);
    expect(report.maxAbsError).toBeCloseTo(1e-3, 6);
  });

  it('accepts a perturbation within rtol', () => {
    const expected = [1000, 2000];
    const actual = [1000.0005, 2000];
    expect(compareWithTolerance(actual, expected, { rtol: 1e-6, atol: 0 }).pass).toBe(true);
  });

  it('treats NaN as failure unless equalNan is set (nodata seams)', () => {
    const expected = [0.1, NaN, 0.3];
    const actual = [0.1, NaN, 0.3];
    expect(compareWithTolerance(actual, expected, TIGHT).pass).toBe(false);
    expect(compareWithTolerance(actual, expected, { ...TIGHT, equalNan: true }).pass).toBe(true);
  });

  it('fails mismatched NaN positions even with equalNan', () => {
    const report = compareWithTolerance([NaN, 0.2], [0.1, 0.2], { ...TIGHT, equalNan: true });
    expect(report.pass).toBe(false);
    expect(report.firstFailureIndex).toBe(0);
  });

  it('throws on length mismatch rather than truncating silently', () => {
    expect(() => compareWithTolerance([1, 2], [1, 2, 3], TIGHT)).toThrow(RangeError);
  });
});
