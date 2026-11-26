// The development web build reaches the API through its own origin, so the
// browser's CORS check never applies (the owner's report of 2026-11-26: the
// app on http://localhost:8082 couldn't sign in). Everything else calls the
// API directly.

import { DEV_API_PROXY_PREFIX, requestBaseFor } from '../network';

const LIVE = 'https://metromatrix-api.duckdns.org/api/v1';

describe('requestBaseFor', () => {
  it('a development web page on another origin goes through its own /__api', () => {
    expect(requestBaseFor(LIVE, { web: true, dev: true, origin: 'http://localhost:8082' })).toBe(
      `http://localhost:8082${DEV_API_PROXY_PREFIX}/api/v1`,
    );
    expect(requestBaseFor('http://localhost:3000/api/v1', { web: true, dev: true, origin: 'http://localhost:19006' })).toBe(
      'http://localhost:19006/__api/api/v1',
    );
  });

  it('phones, release builds and a page already on the API origin call it directly', () => {
    expect(requestBaseFor(LIVE, { web: false, dev: true, origin: null })).toBe(LIVE);
    expect(requestBaseFor(LIVE, { web: true, dev: false, origin: 'https://app.metromatrix.pk' })).toBe(LIVE);
    expect(requestBaseFor(LIVE, { web: true, dev: true, origin: 'https://metromatrix-api.duckdns.org' })).toBe(LIVE);
  });

  it('no API address stays no API address (the build shows its configuration error)', () => {
    expect(requestBaseFor('', { web: true, dev: true, origin: 'http://localhost:8082' })).toBe('');
  });
});
