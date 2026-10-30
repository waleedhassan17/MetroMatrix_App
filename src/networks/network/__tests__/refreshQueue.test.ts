import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { api, AuthError, extractErrorCode, refreshClient, toAuthError, unwrap } from '../apiHelpers';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '../../../utils/storageUtils';
import {
  clearIntentionalSignOut,
  markIntentionalSignOut,
  setBusinessStatusStaleHandler,
  setSessionExpiredHandler,
} from '../../../utils/authEvents';

// The adapter stands in for the server: a request carrying the NEW access
// token succeeds; anything else is a 401 (expired token).
const respond = (config: InternalAxiosRequestConfig, status: number, data: unknown): AxiosResponse => ({
  data,
  status,
  statusText: String(status),
  headers: {},
  config,
});

const fail = (config: InternalAxiosRequestConfig, status: number, data: unknown) =>
  new AxiosError(`HTTP ${status}`, 'ERR_BAD_RESPONSE', config, null, respond(config, status, data));

const tokenServer = (config: InternalAxiosRequestConfig) => {
  if (config.headers.Authorization === 'Bearer access-2') {
    return Promise.resolve(respond(config, 200, { data: { url: config.url } }));
  }
  return Promise.reject(fail(config, 401, { error: { code: 'TOKEN_EXPIRED', message: 'Expired' } }));
};

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/** What the refresh endpoint answers, as an axios error. */
const serverSays = (status: number, code: string) =>
  new AxiosError(`HTTP ${status}`, 'ERR_BAD_RESPONSE', {} as never, null, {
    data: { error: { code, message: code } },
    status,
    statusText: String(status),
    headers: {},
    config: {} as never,
  });

describe('apiHelpers — single-flight refresh', () => {
  let refreshSpy: jest.SpyInstance;
  const expired = jest.fn();

  beforeEach(async () => {
    clearIntentionalSignOut();
    await setTokens('access-1', 'refresh-1');
    api.defaults.adapter = tokenServer as never;
    expired.mockReset();
    setSessionExpiredHandler(expired);
    refreshSpy = jest.spyOn(refreshClient, 'post').mockImplementation(async () => {
      await delay(20); // keep the refresh in flight while the others arrive
      return { data: { data: { accessToken: 'access-2', refreshToken: 'refresh-2' } } };
    });
  });

  afterEach(() => {
    refreshSpy.mockRestore();
    setSessionExpiredHandler(null);
  });

  it('two concurrent 401s trigger exactly ONE refresh, and both requests succeed', async () => {
    const [a, b] = await Promise.all([api.get('/orders'), api.get('/profile')]);

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(refreshSpy.mock.calls[0][1]).toEqual({ refreshToken: 'refresh-1' });
    expect(unwrap(a)).toEqual({ url: '/orders' });
    expect(unwrap(b)).toEqual({ url: '/profile' });
    expect(await getAccessToken()).toBe('access-2');
    expect(await getRefreshToken()).toBe('refresh-2');
    expect(expired).not.toHaveBeenCalled();
  });

  it('posts to /auth/refresh-token and stores the bare TokenPair', async () => {
    refreshSpy.mockResolvedValue({ data: { success: true, data: { accessToken: 'access-2', refreshToken: 'refresh-2', expiresIn: 900 } } });
    await api.get('/orders');
    expect(refreshSpy.mock.calls[0][0]).toBe('/auth/refresh-token');
    expect(await getRefreshToken()).toBe('refresh-2');
  });

  it('a refresh response without both tokens fails the request but keeps the session (not definitive)', async () => {
    refreshSpy.mockResolvedValue({ data: { data: { tokens: { accessToken: 'access-2', refreshToken: 'refresh-2' } } } });
    await expect(api.get('/orders')).rejects.toBeDefined();
    expect(expired).not.toHaveBeenCalled();
    expect(await getRefreshToken()).toBe('refresh-1');
  });

  it('five concurrent 401s still refresh once', async () => {
    await Promise.all(['/a', '/b', '/c', '/d', '/e'].map(u => api.get(u)));
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it('a definitively refused refresh rejects every queued request, clears tokens and announces expiry ONCE', async () => {
    refreshSpy.mockImplementation(async () => {
      await delay(20);
      throw serverSays(401, 'REFRESH_INVALID');
    });

    const results = await Promise.allSettled([api.get('/a'), api.get('/b'), api.get('/c')]);

    expect(results.every(r => r.status === 'rejected')).toBe(true);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(expired).toHaveBeenCalledTimes(1);
    expect(expired).toHaveBeenCalledWith('REFRESH_INVALID');
    expect(await getAccessToken()).toBeNull();
  });

  it('REFRESH_REUSED ends the session with its own reason (the security toast)', async () => {
    refreshSpy.mockRejectedValue(serverSays(401, 'REFRESH_REUSED'));
    const err = await api.get('/a').catch(e => e);
    expect(extractErrorCode(err)).toBe('REFRESH_REUSED');
    expect(expired).toHaveBeenCalledWith('REFRESH_REUSED');
    expect(await getRefreshToken()).toBeNull();
  });

  it.each([
    ['offline', () => new AxiosError('Network Error', 'ERR_NETWORK', {} as never, {}, undefined)],
    ['a 503', () => serverSays(503, 'SERVICE_UNAVAILABLE')],
    ['a 429', () => serverSays(429, 'RATE_LIMITED')],
    ['a 500', () => serverSays(500, 'INTERNAL_ERROR')],
  ])('a refresh that fails transiently (%s) fails only this request: tokens kept, no sign-out', async (_n, make) => {
    refreshSpy.mockRejectedValue(make());
    await expect(api.get('/a')).rejects.toBeDefined();
    expect(expired).not.toHaveBeenCalled();
    expect(await getAccessToken()).toBe('access-1');
    expect(await getRefreshToken()).toBe('refresh-1');

    // The next request tries again and recovers.
    refreshSpy.mockResolvedValue({ data: { data: { accessToken: 'access-2', refreshToken: 'refresh-2' } } });
    await expect(api.get('/b')).resolves.toBeDefined();
  });

  it('does not refresh on auth routes — a 401 there is the real answer', async () => {
    await expect(api.post('/auth/signin', { email: 'a', password: 'b' })).rejects.toBeInstanceOf(AxiosError);
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('does not refresh or announce during an intentional sign-out', async () => {
    markIntentionalSignOut();
    await expect(api.get('/orders')).rejects.toBeInstanceOf(AxiosError);
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(expired).not.toHaveBeenCalled();
  });

  it('with no refresh token, the session ends without a network call', async () => {
    await clearTokens();
    await expect(api.get('/orders')).rejects.toBeDefined();
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(expired).toHaveBeenCalledTimes(1);
    expect(expired).toHaveBeenCalledWith('NO_REFRESH_TOKEN');
  });

  it('403 ACCOUNT_DISABLED on any request ends the session', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) =>
      Promise.reject(fail(config, 403, { error: { code: 'ACCOUNT_DISABLED', message: 'Disabled' } }))) as never;
    await expect(api.get('/orders')).rejects.toBeDefined();
    expect(expired).toHaveBeenCalledWith('ACCOUNT_DISABLED');
    expect(await getAccessToken()).toBeNull();
  });
});

describe('apiHelpers — status gates and errors', () => {
  it('403 BUSINESS_SUSPENDED fires the business-status-stale bridge', async () => {
    const stale = jest.fn();
    setBusinessStatusStaleHandler(stale);
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) =>
      Promise.reject(fail(config, 403, { error: { code: 'BUSINESS_SUSPENDED', message: 'Paused' } }))) as never;

    await expect(api.get('/businesses/me')).rejects.toBeDefined();
    expect(stale).toHaveBeenCalledTimes(1);
    setBusinessStatusStaleHandler(null);
  });

  it('toAuthError keeps message, code, status and details', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) =>
      Promise.reject(
        fail(config, 422, {
          error: { code: 'DOCUMENTS_MISSING', message: 'Upload your PMDC certificate', details: { missing: ['pmdc_certificate'] } },
        }),
      )) as never;
    const err = toAuthError(await api.post('/businesses/me/submit').catch(e => e));
    expect(err).toBeInstanceOf(AuthError);
    expect(err).toMatchObject({
      message: 'Upload your PMDC certificate',
      code: 'DOCUMENTS_MISSING',
      status: 422,
      details: { missing: ['pmdc_certificate'] },
    });
  });

  it('a request that never got a response is a NETWORK_ERROR with an offline message', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) =>
      Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK', config, {}, undefined))) as never;
    const raw = await api.get('/x').catch(e => e);
    expect(extractErrorCode(raw)).toBe('NETWORK_ERROR');
    expect(toAuthError(raw).message).toMatch(/offline/);
  });
});
