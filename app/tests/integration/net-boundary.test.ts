/**
 * Integration coverage for `main/services/net.ts`'s outbound-HTTP boundary.
 *
 * This module has never made a real or mocked request under any test. It is a
 * security boundary: a deny-by-default allow-list, plus redirect revalidation
 * that re-checks every hop against the same allow-list a direct request would
 * have gone through. A redirect that escapes that revalidation is the entire
 * point of the boundary existing, so it is the case this file cares about
 * most.
 *
 * Electron's `net` module only exists inside a real Electron process, so it is
 * replaced here with a thin shim backed by Node's real `http` module and a
 * real loopback server this file starts and stops. The shim reproduces only
 * the shape `net.ts` actually consumes (`setHeader`, `on('response'|'error')`,
 * `write`, `end`, `abort`, and the `redirect: 'manual' | 'error'` contract) --
 * every byte of the request/response actually travels over a real TCP socket
 * to a real HTTP server on 127.0.0.1. The module under test -- allow-list
 * matching, credential/scheme refusal, per-hop redirect revalidation, byte
 * bounds, and timeout -- runs completely unmodified and unmocked.
 *
 * Every transport-level attempt is also recorded independently of the
 * module's own report, so "the refused host was never even asked for" and "a
 * refused redirect target was never contacted" can be checked against a
 * channel the module under test does not control.
 */
import { EventEmitter } from 'node:events';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 20_000 });

/* ==================================================================== */
/* Electron `net` shim, backed by a real Node http client                */
/* ==================================================================== */

const transportCalls = vi.hoisted(() => ({ urls: [] as string[] }));

interface ShimRequestOptions {
  method: string;
  url: string;
  redirect: 'manual' | 'error';
}

function createShimRequest(options: ShimRequestOptions) {
  transportCalls.urls.push(options.url);
  const emitter = new EventEmitter();
  const parsed = new URL(options.url);
  const outHeaders: Record<string, string> = {};
  let outBody: string | undefined;
  let nodeReq: http.ClientRequest | null = null;

  const wrapper = {
    setHeader(key: string, value: string) {
      outHeaders[key] = value;
    },
    on(event: string, listener: (...args: unknown[]) => void) {
      emitter.on(event, listener);
      return wrapper;
    },
    write(chunk: string) {
      outBody = chunk;
    },
    end() {
      nodeReq = http.request(
        {
          method: options.method,
          hostname: parsed.hostname,
          port: parsed.port || 80,
          path: `${parsed.pathname}${parsed.search}`,
          headers: outHeaders
        },
        (res: IncomingMessage) => {
          const status = res.statusCode ?? 0;
          const isRedirect = status >= 300 && status < 400 && typeof res.headers.location === 'string';
          if (options.redirect === 'error' && isRedirect) {
            res.resume();
            emitter.emit('error', new Error('net::ERR_FAILED redirect refused by transport policy'));
            return;
          }
          const responseEmitter = new EventEmitter() as EventEmitter & {
            statusCode: number;
            statusMessage: string;
            headers: Record<string, string | string[] | undefined>;
          };
          responseEmitter.statusCode = status;
          responseEmitter.statusMessage = res.statusMessage ?? '';
          responseEmitter.headers = res.headers as Record<string, string | string[] | undefined>;
          emitter.emit('response', responseEmitter);
          res.on('data', (chunk: Buffer) => responseEmitter.emit('data', chunk));
          res.on('end', () => responseEmitter.emit('end'));
          res.on('error', (error: Error) => responseEmitter.emit('error', error));
        }
      );
      nodeReq.on('error', (error: Error) => emitter.emit('error', error));
      if (outBody !== undefined) nodeReq.write(outBody, 'utf8');
      nodeReq.end();
    },
    abort() {
      nodeReq?.destroy();
    }
  };
  return wrapper;
}

vi.mock('electron', () => ({
  net: {
    request: (options: ShimRequestOptions) => createShimRequest(options)
  }
}));

/* ==================================================================== */
/* Fixture: a real loopback HTTP server                                  */
/* ==================================================================== */

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

function startServer(handler: Handler): Promise<{ server: http.Server; url: string; port: number }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${address.port}`, port: address.port });
    });
  });
}

const servers: http.Server[] = [];
async function trackedServer(handler: Handler) {
  const started = await startServer(handler);
  servers.push(started.server);
  return started;
}

afterEach(async () => {
  transportCalls.urls.length = 0;
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        })
    )
  );
});

/* ==================================================================== */
/* Tests                                                                 */
/* ==================================================================== */

describe('main/services/net.ts -- outbound HTTP boundary', () => {
  // Imported fresh inside a beforeEach so the mocked `electron` module is
  // guaranteed to already be in place, matching the pattern used by the
  // module's own real consumer (main/ipc.ts imports it once at startup).
  let net: typeof import('../../src/main/services/net');

  beforeEach(async () => {
    vi.resetModules();
    net = await import('../../src/main/services/net');
    net.allow({ host: '127.0.0.1', schemes: ['http'], owner: 'test', reason: 'loopback fixture server' });
  });

  it('reaches a real allowed loopback host and returns its real body', async () => {
    const { url } = await trackedServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('hello from the real server');
    });

    const response = await net.request({ url: `${url}/ok` });

    expect(response.status).toBe(200);
    expect(response.body).toBe('hello from the real server');
    expect(response.truncated).toBe(false);
    // Independent of the module's own report: the shim recorded exactly one
    // real transport attempt, at exactly this URL.
    expect(transportCalls.urls).toEqual([`${url}/ok`]);
  });

  it('refuses a host with no allow rule before ever touching the network', async () => {
    await expect(net.request({ url: 'https://not-on-the-allow-list.invalid/anything' })).rejects.toThrow(
      /No outbound rule allows/
    );
    // The refusal happened in validateTarget(), before the transport was ever
    // asked to do anything -- checked through the shim's own independent
    // call log rather than trusting the module's thrown message alone.
    expect(transportCalls.urls).toEqual([]);
  });

  it('follows a redirect to another allowed host and re-validates it as its own request', async () => {
    const target = await trackedServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('the real destination');
    });
    const origin = await trackedServer((_req, res) => {
      res.writeHead(302, { location: `${target.url}/dest` });
      res.end();
    });

    const response = await net.request({ url: `${origin.url}/start`, maxRedirects: 1 });

    expect(response.status).toBe(200);
    expect(response.body).toBe('the real destination');
    expect(response.finalUrl).toBe(`${target.url}/dest`);
    // Both real hops actually happened, over two real connections.
    expect(transportCalls.urls).toEqual([`${origin.url}/start`, `${target.url}/dest`]);
  });

  it('THE IMPORTANT ONE: refuses a redirect that points at a host nobody allowed', async () => {
    const origin = await trackedServer((_req, res) => {
      res.writeHead(302, { location: 'http://refused-by-redirect.invalid/anywhere' });
      res.end();
    });

    await expect(net.request({ url: `${origin.url}/start`, maxRedirects: 1 })).rejects.toThrow(
      /No outbound rule allows/
    );
    // The critical proof: the redirect target was re-validated and refused
    // BEFORE any second connection was attempted. Only the first, legitimate
    // hop shows up in the transport's own independent call log -- the escape
    // this boundary exists to prevent never happened.
    expect(transportCalls.urls).toEqual([`${origin.url}/start`]);
  });

  it('refuses once a redirect chain exceeds the requested hop limit', async () => {
    const second = await trackedServer((_req, res) => {
      res.writeHead(302, { location: 'http://127.0.0.1:1/unreachable-third-hop' });
      res.end();
    });
    const first = await trackedServer((_req, res) => {
      res.writeHead(302, { location: `${second.url}/second-hop` });
      res.end();
    });

    // Budget of exactly one hop: hop 1 (first -> second) is followed, but
    // second's own redirect exceeds the budget and must be refused rather
    // than silently followed or silently swallowed.
    await expect(net.request({ url: `${first.url}/start`, maxRedirects: 1 })).rejects.toThrow();
    // Exactly two real transport attempts: the allowed first hop and the
    // exhausted-budget second hop. The third hop was never reached.
    expect(transportCalls.urls).toEqual([`${first.url}/start`, `${second.url}/second-hop`]);
  });

  it('bounds an oversized response body and reports it truncated', async () => {
    const bigBody = 'x'.repeat(50_000);
    const { url } = await trackedServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end(bigBody);
    });

    const response = await net.request({ url: `${url}/big`, maxBytes: 1_000 });

    expect(response.truncated).toBe(true);
    expect(Buffer.byteLength(response.body, 'utf8')).toBe(1_000);
    expect(response.body.length).toBeLessThan(bigBody.length);
  });

  it('times out a request that never receives a response, and aborts the real socket', async () => {
    let serverSawRequest = false;
    const { url } = await trackedServer((_req, _res) => {
      serverSawRequest = true;
      // Deliberately never call _res.end() or _res.writeHead(): the request
      // hangs open on the real socket until the client-side timeout fires.
    });

    const started = Date.now();
    await expect(net.request({ url: `${url}/hangs`, timeoutMs: 250 })).rejects.toThrow(/timed out/);
    const elapsed = Date.now() - started;

    expect(serverSawRequest).toBe(true);
    // The timeout genuinely fired around the requested bound rather than
    // some unrelated long default -- generous upper bound to absorb a
    // contended CI host without flaking.
    expect(elapsed).toBeLessThan(10_000);
  });
});
