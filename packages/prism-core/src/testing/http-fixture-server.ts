/**
 * Test-only static file server for store-conformance suites: serves a fixture
 * directory over real HTTP (loopback) and logs every request, so tests can
 * assert both decoded values and request mechanics (Range headers, coalescing).
 * Node-only; never shipped to the browser bundle (not exported from index).
 */
import { createReadStream, promises as fs } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { join, normalize, sep } from 'node:path';

export interface LoggedRequest {
  method: string;
  path: string;
  range: string | null;
  authorization: string | null;
  status: number;
}

export interface FixtureServer {
  url: string;
  requests: LoggedRequest[];
  close(): Promise<void>;
}

/** What an auth gate sees about an incoming request. */
export interface IncomingAuth {
  path: string;
  authorization: string | null;
  /** All request headers, lowercased keys (for custom-header auth schemes). */
  headers: Record<string, string>;
  /** Parsed query parameters (for pre-signed-URL auth schemes). */
  query: URLSearchParams;
}

export interface FixtureServerOptions {
  /**
   * Optional auth gate: return false to reject with 401 before serving. Models
   * an Earthdata-class protected endpoint for SP-DP-010 conformance.
   */
  requireAuth?: (auth: IncomingAuth) => boolean;
  /**
   * Reference-baseline network simulation (SPEC Section 9): one-way latency
   * applied before every response, and a byte-rate cap on the body. Off by
   * default so conformance suites stay fast; the perf harness sets both.
   */
  latencyMs?: number;
  bandwidthBytesPerSec?: number;
  /**
   * Ignore Range requests: reply 200 with the whole object even when a Range
   * header is sent (some misconfigured hosts do this). Exercises the store
   * layer's defensive slicing.
   */
  ignoreRange?: boolean;
}

interface ByteRange {
  start: number;
  end: number;
}

function parseRange(header: string, size: number): ByteRange | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') return null;
  if (rawStart === '') {
    const suffix = Number(rawEnd);
    if (suffix === 0) return null;
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(rawStart);
  const end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1);
  if (start > end || start >= size) return null;
  return { start, end };
}

export async function startFixtureServer(
  rootDir: string,
  options: FixtureServerOptions = {},
): Promise<FixtureServer> {
  const requests: LoggedRequest[] = [];

  const { latencyMs = 0, bandwidthBytesPerSec } = options;
  // Lumped network model: one-way latency plus body transfer time. Faithful
  // enough for probe-latency measurement, which is dominated by RTT plus one
  // spectral-chunk transfer; not a packet-level simulation.
  const simulateNetwork = (bodyBytes: number): Promise<void> => {
    if (latencyMs === 0 && !bandwidthBytesPerSec) return Promise.resolve();
    const transferMs = bandwidthBytesPerSec ? (bodyBytes / bandwidthBytesPerSec) * 1000 : 0;
    return new Promise((resolve) => setTimeout(resolve, latencyMs + transferMs));
  };

  const server: Server = createServer((req, res) => {
    void (async () => {
      const method = req.method ?? 'GET';
      const requestUrl = new URL(req.url ?? '/', 'http://fixture');
      const urlPath = decodeURIComponent(requestUrl.pathname);
      const rangeHeader = req.headers.range ?? null;
      const authorization = req.headers.authorization ?? null;
      const log = (status: number) => {
        requests.push({ method, path: urlPath, range: rangeHeader, authorization, status });
        return status;
      };

      if (options.requireAuth) {
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(req.headers)) {
          if (typeof v === 'string') headers[k.toLowerCase()] = v;
        }
        const ok = options.requireAuth({
          path: urlPath,
          authorization,
          headers,
          query: requestUrl.searchParams,
        });
        if (!ok) {
          res.writeHead(log(401), { 'www-authenticate': 'Bearer realm="fixture"' }).end();
          return;
        }
      }

      const filePath = join(rootDir, normalize(urlPath));
      if (!filePath.startsWith(rootDir + sep) && filePath !== rootDir) {
        res.writeHead(log(403)).end();
        return;
      }

      let size: number;
      try {
        const stat = await fs.stat(filePath);
        if (!stat.isFile()) throw new Error('not a file');
        size = stat.size;
      } catch {
        res.writeHead(log(404)).end();
        return;
      }

      const headers: Record<string, string> = {
        'accept-ranges': 'bytes',
        'content-type': 'application/octet-stream',
      };

      if (rangeHeader !== null && !options.ignoreRange) {
        const range = parseRange(rangeHeader, size);
        if (range === null) {
          res.writeHead(log(416), { 'content-range': `bytes */${size}` }).end();
          return;
        }
        const bodyBytes = range.end - range.start + 1;
        headers['content-range'] = `bytes ${range.start}-${range.end}/${size}`;
        headers['content-length'] = String(bodyBytes);
        await simulateNetwork(method === 'HEAD' ? 0 : bodyBytes);
        res.writeHead(log(206), headers);
        if (method === 'HEAD') {
          res.end();
          return;
        }
        createReadStream(filePath, { start: range.start, end: range.end }).pipe(res);
        return;
      }

      headers['content-length'] = String(size);
      await simulateNetwork(method === 'HEAD' ? 0 : size);
      res.writeHead(log(200), headers);
      if (method === 'HEAD') {
        res.end();
        return;
      }
      createReadStream(filePath).pipe(res);
    })();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('fixture server failed to bind a loopback port');
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
