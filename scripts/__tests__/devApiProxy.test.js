/**
 * @jest-environment node
 */
// The dev server's API forwarder (scripts/devApiProxy.js), against a real
// local server standing in for the API.

const http = require('http');
const { createDevApiProxy } = require('../devApiProxy');

const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const close = server => new Promise(resolve => server.close(resolve));

const call = (port, { method = 'GET', path, headers = {}, body }) =>
  new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path, headers }, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });

let api;
let apiPort;
let seen;
let front;
let frontPort;

beforeAll(async () => {
  api = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => (body += c));
    req.on('end', () => {
      seen = { method: req.method, url: req.url, headers: req.headers, body };
      res.writeHead(401, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://elsewhere.example',
        'X-Request-Id': 'r1',
      });
      res.end(JSON.stringify({ success: false, error: { code: 'INVALID_CREDENTIALS' } }));
    });
  });
  apiPort = await listen(api);
  const proxy = createDevApiProxy(`http://127.0.0.1:${apiPort}/api/v1`);
  front = http.createServer((req, res) =>
    proxy(req, res, () => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('metro');
    }),
  );
  frontPort = await listen(front);
});

afterAll(async () => {
  await close(front);
  await close(api);
});

describe('devApiProxy', () => {
  it('forwards method, path, body and headers, without the browser origin', async () => {
    const body = JSON.stringify({ email: 'a@example.com', password: 'x', portal: 'customer' });
    const res = await call(frontPort, {
      method: 'POST',
      path: '/__api/api/v1/auth/signin?x=1',
      body,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer t',
        'Idempotency-Key': 'k1',
        Origin: 'http://localhost:8082',
        Referer: 'http://localhost:8082/sign-in',
      },
    });
    expect(seen).toMatchObject({ method: 'POST', url: '/api/v1/auth/signin?x=1', body });
    expect(seen.headers).toMatchObject({ authorization: 'Bearer t', 'idempotency-key': 'k1', host: `127.0.0.1:${apiPort}` });
    expect(seen.headers.origin).toBeUndefined();
    expect(seen.headers.referer).toBeUndefined();

    // The answer comes back as it was, minus the API's CORS headers.
    expect(res.status).toBe(401);
    expect(JSON.parse(res.body).error.code).toBe('INVALID_CREDENTIALS');
    expect(res.headers['x-request-id']).toBe('r1');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('leaves everything else to the dev server', async () => {
    const res = await call(frontPort, { path: '/index.bundle?platform=web' });
    expect(res.body).toBe('metro');
    const near = await call(frontPort, { path: '/__apis' });
    expect(near.body).toBe('metro');
  });

  it('drops the connection when the API gives no answer', async () => {
    const dead = createDevApiProxy('http://127.0.0.1:1/api/v1');
    const server = http.createServer((req, res) => dead(req, res, () => res.end('metro')));
    const port = await listen(server);
    await expect(call(port, { path: '/__api/api/v1/health' })).rejects.toThrow();
    await close(server);
  });

  it('says so when the dev server has no API address', async () => {
    const none = createDevApiProxy(undefined);
    const server = http.createServer((req, res) => none(req, res, () => res.end('metro')));
    const port = await listen(server);
    const res = await call(port, { path: '/__api/api/v1/health' });
    expect(res.status).toBe(503);
    expect(JSON.parse(res.body).error.code).toBe('CONFIG_ERROR');
    await close(server);
  });
});
