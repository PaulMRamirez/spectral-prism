/**
 * Tolerance comparison for kernel parity suites (ADR-0008): wasm tier vs.
 * WebGPU tier vs. NumPy/SciPy oracle fixtures. Semantics match numpy.allclose:
 * a value passes when |actual - expected| <= atol + rtol * |expected|.
 * Tolerance changes require an ADR-0008 amendment, never a test edit.
 */
export interface ToleranceOptions {
  /** Relative tolerance, scaled by |expected|. */
  rtol: number;
  /** Absolute tolerance floor. */
  atol: number;
  /** Treat NaN in the same position on both sides as equal (nodata seams). */
  equalNan?: boolean;
}

export interface ToleranceReport {
  pass: boolean;
  compared: number;
  failures: number;
  maxAbsError: number;
  maxRelError: number;
  firstFailureIndex: number | null;
}

export function compareWithTolerance(
  actual: ArrayLike<number>,
  expected: ArrayLike<number>,
  { rtol, atol, equalNan = false }: ToleranceOptions,
): ToleranceReport {
  if (actual.length !== expected.length) {
    throw new RangeError(
      `length mismatch: actual has ${actual.length} values, expected has ${expected.length}`,
    );
  }

  let failures = 0;
  let maxAbsError = 0;
  let maxRelError = 0;
  let firstFailureIndex: number | null = null;

  for (let i = 0; i < expected.length; i++) {
    const a = actual[i] as number;
    const e = expected[i] as number;

    if (Number.isNaN(a) || Number.isNaN(e)) {
      if (equalNan && Number.isNaN(a) && Number.isNaN(e)) continue;
      failures++;
      firstFailureIndex ??= i;
      continue;
    }

    const absError = Math.abs(a - e);
    if (absError > maxAbsError) maxAbsError = absError;
    if (e !== 0) {
      const relError = absError / Math.abs(e);
      if (relError > maxRelError) maxRelError = relError;
    }
    if (absError > atol + rtol * Math.abs(e)) {
      failures++;
      firstFailureIndex ??= i;
    }
  }

  return {
    pass: failures === 0,
    compared: expected.length,
    failures,
    maxAbsError,
    maxRelError,
    firstFailureIndex,
  };
}
