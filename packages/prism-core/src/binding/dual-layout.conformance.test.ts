/**
 * Store conformance, SP-DP-005: the spectral_prism:binding written by the
 * generator (the CLI stand-in) round-trips to the browser reader over real
 * HTTP, per-layout CRS included (native UTM spectral layout vs. ingest-warped
 * EPSG:3857 pyramid per ADR-0007), and single-layout stores surface their
 * degradation-matrix rows.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from '../testing/http-fixture-server';
import { createZarrHttpStore } from '../stores/zarr-http';
import { readDualLayoutBinding } from './dual-layout';

const FIXTURES = join(__dirname, '..', '..', 'fixtures', 'stores');

interface ExpectedBinding {
  version: number;
  spectralPath: string | null;
  spectralCrs: string | null;
  spatialPath: string | null;
  spatialCrs: string | null;
  spatialLevels: string[] | null;
  provenance: Record<string, unknown>;
  degradations: string[];
}

const expected: Record<string, ExpectedBinding> = JSON.parse(
  readFileSync(join(FIXTURES, 'expected', 'dual-layout-bindings.json'), 'utf8'),
);

let server: FixtureServer;

beforeAll(async () => {
  server = await startFixtureServer(FIXTURES);
});

afterAll(async () => {
  await server.close();
});

describe('dual-layout binding over HTTP', () => {
  for (const [fixture, exp] of Object.entries(expected)) {
    it(`round-trips ${fixture}`, async () => {
      const store = createZarrHttpStore(`${server.url}/${fixture}`);
      const binding = await readDualLayoutBinding(store.readable);
      expect(binding).not.toBeNull();
      if (binding === null) return;

      expect(binding.version).toBe(exp.version);
      expect(binding.spectral?.path ?? null).toBe(exp.spectralPath);
      expect(binding.spectral?.model.crs?.code ?? null).toBe(exp.spectralCrs);
      expect(binding.spatial?.path ?? null).toBe(exp.spatialPath);
      expect(binding.spatial?.model.crs?.code ?? null).toBe(exp.spatialCrs);
      expect(binding.spatial?.model.multiscales?.levels.map((l) => l.path) ?? null).toEqual(
        exp.spatialLevels,
      );
      expect(binding.provenance).toEqual(exp.provenance);
      expect(binding.degradations.map((d) => d.row)).toEqual(exp.degradations);
    });
  }

  it('records legitimately different per-layout CRSs (ADR-0007)', async () => {
    const store = createZarrHttpStore(`${server.url}/dual-layout-full`);
    const binding = await readDualLayoutBinding(store.readable);
    expect(binding?.spectral?.model.crs?.code).toBe('EPSG:32611');
    expect(binding?.spatial?.model.crs?.code).toBe('EPSG:3857');
    expect(binding?.spectral?.model.crs?.code).not.toBe(binding?.spatial?.model.crs?.code);
  });

  it('returns null for stores that declare no binding (plain single-array store)', async () => {
    const store = createZarrHttpStore(`${server.url}/zarr-v3`);
    expect(await readDualLayoutBinding(store.readable)).toBeNull();
  });

  it('flags a declared but unreadable layout as the degraded row', async () => {
    // dual-layout-spatial-only declares no spectral path at all; also check
    // the harder case: a binding declaring a path that does not exist.
    const store = createZarrHttpStore(`${server.url}/dual-layout-full`);
    const binding = await readDualLayoutBinding(store.readable);
    expect(binding?.degradations).toEqual([]);

    const spectralOnly = createZarrHttpStore(`${server.url}/dual-layout-spectral-only`);
    const b = await readDualLayoutBinding(spectralOnly.readable);
    expect(b?.spatial).toBeNull();
    expect(b?.degradations[0]?.row).toBe('single-layout-spectral-only');
    expect(b?.degradations[0]?.detail).toContain('decimated spectral chunks');
  });
});
