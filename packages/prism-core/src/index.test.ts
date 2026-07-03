import { describe, expect, it } from 'vitest';
import { PRISM_CORE_STAGE } from './index';

describe('prism-core scaffold', () => {
  it('exports the Stage 1 extraction anchor', () => {
    expect(PRISM_CORE_STAGE).toBe(1);
  });
});
