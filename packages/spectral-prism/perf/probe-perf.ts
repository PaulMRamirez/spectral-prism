/**
 * Perf harness (SP-DP-007/008). Measures probe-to-spectrum latency and
 * cold-open-to-composite-data against an AVIRIS-class store, under a simulated
 * reference baseline (SPEC Section 9: 50 ms RTT, 50 Mbps). This is the harness
 * that will run against the demo mirror once it exists (set PERF_STORE_URL);
 * with no URL it serves the local .perf-fixtures store, which is a proxy, not
 * the gate measurement (the gate requires the mirror on reference hardware).
 *
 *   pnpm perf                              # local proxy, simulated reference net
 *   PERF_STORE_URL=https://... pnpm perf   # against the demo mirror (no sim)
 *
 * Lives in spectral-prism (the consumer): the probe is a Stage-2-reserved model
 * that stays with its consumer per ADR-0006, so its harness does too.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import * as zarr from 'zarrita';
import {
  createZarrHttpStore,
  readDualLayoutBinding,
  scopedReadable,
  readGeoZarr,
} from 'prism-core';
import { startFixtureServer, type FixtureServer } from 'prism-core/testing';
import { extractProbeSpectrum } from '../src/data/probe';

const HERE = dirname(fileURLToPath(import.meta.url));
const PERF_FIXTURES = join(HERE, '..', '.perf-fixtures');

const PROBE_TARGET_MS = 200; // SP-DP-007
const COLD_OPEN_TARGET_MS = 5000; // SP-DP-008
const REFERENCE_LATENCY_MS = 50; // SPEC Section 9: 50 ms RTT
const REFERENCE_BANDWIDTH_BPS = (50 * 1_000_000) / 8; // 50 Mbps in bytes/s

interface Meta {
  bands: number;
  height: number;
  width: number;
  compositeBands: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx] as number;
}

async function coldOpenComposite(storeUrl: string, compositeBands: number): Promise<number> {
  const t0 = performance.now();
  const store = createZarrHttpStore(storeUrl);
  const binding = await readDualLayoutBinding(store.readable);
  if (!binding?.spatial) throw new Error('perf store has no spatial layout');
  const layout = scopedReadable(store.readable, binding.spatial.path);
  await readGeoZarr(layout);
  const group = await zarr.open(layout, { kind: 'group' });
  const level0 = await zarr.open(group.resolve('0'), { kind: 'array' });
  const tile = Math.min(256, level0.shape[1] as number);
  const bands = Math.min(compositeBands, level0.shape[0] as number);
  await zarr.get(level0, [zarr.slice(0, bands), zarr.slice(0, tile), zarr.slice(0, tile)]);
  return performance.now() - t0;
}

async function probeLatencies(storeUrl: string, samples: number): Promise<number[]> {
  // Suffix-range reads let the sharded probe fetch its inner-chunk index in one
  // round trip instead of HEAD + offset (ADR-0003 sharded spectral layout).
  const store = createZarrHttpStore(storeUrl, { useSuffixRequest: true });
  const binding = await readDualLayoutBinding(store.readable);
  if (!binding?.spectral?.model.spectral) throw new Error('perf store has no spectral layout');
  const layout = scopedReadable(store.readable, binding.spectral.path);
  const group = await zarr.open(layout, { kind: 'group' });
  const array = await zarr.open(group.resolve('cube'), { kind: 'array' });
  const axis = binding.spectral.model.spectral;
  const [, height, width] = array.shape as [number, number, number];

  const latencies: number[] = [];
  for (let i = 0; i < samples; i++) {
    const y = Math.floor((i / samples) * height);
    const x = (i * 137) % width;
    const t0 = performance.now();
    await extractProbeSpectrum(array, axis, y, x);
    latencies.push(performance.now() - t0);
  }
  return latencies;
}

async function main(): Promise<number> {
  const mirrorUrl = process.env['PERF_STORE_URL'];
  let server: FixtureServer | undefined;
  let storeUrl: string;
  let meta: Meta;

  if (mirrorUrl) {
    storeUrl = mirrorUrl.replace(/\/$/, '');
    meta = { bands: 224, height: 512, width: 512, compositeBands: 8 };
    console.log(`[perf] measuring against mirror: ${storeUrl} (no network simulation)`);
  } else {
    meta = JSON.parse(readFileSync(join(PERF_FIXTURES, 'aviris-class.meta.json'), 'utf8')) as Meta;
    server = await startFixtureServer(PERF_FIXTURES, {
      latencyMs: REFERENCE_LATENCY_MS,
      bandwidthBytesPerSec: REFERENCE_BANDWIDTH_BPS,
    });
    storeUrl = `${server.url}/aviris-class`;
    console.log(
      `[perf] local proxy under simulated reference baseline ` +
        `(${REFERENCE_LATENCY_MS} ms latency, 50 Mbps). NOT the gate measurement.`,
    );
  }

  try {
    const coldOpen = await coldOpenComposite(storeUrl, meta.compositeBands);
    const probes = (await probeLatencies(storeUrl, 20)).sort((a, b) => a - b);
    const probeP50 = percentile(probes, 50);
    const probeP95 = percentile(probes, 95);
    const result = {
      store: mirrorUrl ? 'mirror' : 'local-proxy',
      geometry: `${meta.bands} bands x ${meta.height} x ${meta.width}`,
      coldOpenMs: Math.round(coldOpen),
      coldOpenTargetMs: COLD_OPEN_TARGET_MS,
      probeP50Ms: Math.round(probeP50),
      probeP95Ms: Math.round(probeP95),
      probeTargetMs: PROBE_TARGET_MS,
      probePass: probeP95 <= PROBE_TARGET_MS,
      coldOpenPass: coldOpen <= COLD_OPEN_TARGET_MS,
    };
    console.log(JSON.stringify(result, null, 2));

    if (mirrorUrl) {
      return result.probePass && result.coldOpenPass ? 0 : 1;
    }
    console.log(
      '[perf] local proxy only: exits 0 regardless. The Phase 0 gate requires ' +
        'this harness run against the demo mirror on the reference baseline.',
    );
    return 0;
  } finally {
    await server?.close();
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error('[perf] failed:', err);
    process.exit(2);
  },
);
