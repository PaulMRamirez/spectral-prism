import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixtureServer, type FixtureServer } from './http-fixture-server';

let dir: string;
let server: FixtureServer;

beforeAll(async () => {
  dir = await fs.mkdtemp(join(tmpdir(), 'prism-fixture-server-'));
  await fs.writeFile(join(dir, 'blob.bin'), Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
  server = await startFixtureServer(dir);
});

afterAll(async () => {
  await server.close();
  await fs.rm(dir, { recursive: true, force: true });
});

describe('startFixtureServer', () => {
  it('serves whole files with 200', async () => {
    const res = await fetch(`${server.url}/blob.bin`);
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toHaveLength(10);
  });

  it('serves offset ranges with 206 and correct bytes', async () => {
    const res = await fetch(`${server.url}/blob.bin`, { headers: { range: 'bytes=2-5' } });
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 2-5/10');
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([2, 3, 4, 5]);
  });

  it('serves suffix ranges (shard index reads use these)', async () => {
    const res = await fetch(`${server.url}/blob.bin`, { headers: { range: 'bytes=-3' } });
    expect(res.status).toBe(206);
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([7, 8, 9]);
  });

  it('returns 404 for missing keys and 416 for unsatisfiable ranges', async () => {
    expect((await fetch(`${server.url}/missing`)).status).toBe(404);
    const bad = await fetch(`${server.url}/blob.bin`, { headers: { range: 'bytes=50-60' } });
    expect(bad.status).toBe(416);
  });

  it('refuses path traversal outside the fixture root', async () => {
    const res = await fetch(`${server.url}/..%2F..%2Fetc%2Fhosts`);
    expect([403, 404]).toContain(res.status);
  });

  it('logs every request with its range header', async () => {
    const before = server.requests.length;
    await fetch(`${server.url}/blob.bin`, { headers: { range: 'bytes=0-1' } });
    const logged = server.requests.slice(before);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ path: '/blob.bin', range: 'bytes=0-1', status: 206 });
  });
});
