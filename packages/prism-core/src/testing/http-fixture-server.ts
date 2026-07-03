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

export async function startFixtureServer(rootDir: string): Promise<FixtureServer> {
  const requests: LoggedRequest[] = [];

  const server: Server = createServer((req, res) => {
    void (async () => {
      const method = req.method ?? 'GET';
      const urlPath = decodeURIComponent(new URL(req.url ?? '/', 'http://fixture').pathname);
      const rangeHeader = req.headers.range ?? null;
      const authorization = req.headers.authorization ?? null;
      const log = (status: number) => {
        requests.push({ method, path: urlPath, range: rangeHeader, authorization, status });
        return status;
      };

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

      if (rangeHeader !== null) {
        const range = parseRange(rangeHeader, size);
        if (range === null) {
          res.writeHead(log(416), { 'content-range': `bytes */${size}` }).end();
          return;
        }
        headers['content-range'] = `bytes ${range.start}-${range.end}/${size}`;
        headers['content-length'] = String(range.end - range.start + 1);
        res.writeHead(log(206), headers);
        if (method === 'HEAD') {
          res.end();
          return;
        }
        createReadStream(filePath, { start: range.start, end: range.end }).pipe(res);
        return;
      }

      headers['content-length'] = String(size);
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
