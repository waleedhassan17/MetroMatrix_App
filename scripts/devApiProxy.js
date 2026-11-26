// ═══════════════════════════════════════════════════════
// MetroMatrix — the development web build's API forwarder
// ═══════════════════════════════════════════════════════
// A browser only lets a page at http://localhost:8082 call
// https://metromatrix-api.duckdns.org if the API lists that exact origin
// (CORS). The deployed API lists http://localhost:8081, which another project
// holds on the owner's machine, so `npm run web` on any other port failed
// every request (the owner's report of 2026-11-26).
//
// Instead, in a development web build the app calls its own origin under
// /__api (networks/network/network.ts `requestBaseFor`), and the dev server
// forwards those requests here to the API, server to server, where CORS does
// not apply. Any port works and the API's list stays strict. Native apps and
// release builds call the API directly and never come here.
//
// Only Metro loads this (metro.config.js). It sends on the method, path, body
// and headers (Authorization, Idempotency-Key …) without the browser's Origin
// and Referer, and passes the answer back as it came. When the API gives no
// answer the connection is dropped, so the app reports it the way it reports
// any unreachable server.

const http = require('http');
const https = require('https');

/** The path the app calls on its own origin; the rest of the URL is the API's own path. */
const DEV_API_PROXY_PREFIX = '/__api';

// Connection-level headers, and the browser's own, are not forwarded.
const NOT_FORWARDED = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'origin',
  'referer',
]);

const pick = (headers, drop) => {
  const out = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value !== undefined && !drop(name.toLowerCase())) out[name] = value;
  }
  return out;
};

/**
 * Connect-style middleware: requests under /__api go to `apiUrl`'s origin,
 * everything else to `next`.
 */
function createDevApiProxy(apiUrl) {
  let target = null;
  try {
    target = apiUrl ? new URL(apiUrl) : null;
  } catch {
    target = null;
  }

  return function devApiProxy(req, res, next) {
    const url = req.url || '';
    if (url !== DEV_API_PROXY_PREFIX && !url.startsWith(`${DEV_API_PROXY_PREFIX}/`)) return next();

    if (!target) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: { code: 'CONFIG_ERROR', message: 'EXPO_PUBLIC_API_URL is not set for this dev server.' },
        }),
      );
      return;
    }

    const client = target.protocol === 'https:' ? https : http;
    const upstream = client.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || undefined,
        method: req.method,
        path: url.slice(DEV_API_PROXY_PREFIX.length) || '/',
        headers: { ...pick(req.headers, name => NOT_FORWARDED.has(name)), host: target.host },
      },
      answer => {
        res.writeHead(
          answer.statusCode || 502,
          pick(answer.headers, name => NOT_FORWARDED.has(name) || name.startsWith('access-control-')),
        );
        answer.pipe(res);
      },
    );
    // No answer from the API: drop the connection, as the API itself would.
    upstream.on('error', () => res.destroy());
    req.on('aborted', () => upstream.destroy());
    req.pipe(upstream);
  };
}

module.exports = { createDevApiProxy, DEV_API_PROXY_PREFIX };
