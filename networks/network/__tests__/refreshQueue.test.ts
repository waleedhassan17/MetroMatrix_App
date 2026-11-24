import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { MainAxiosInstance, ApiError, extractErrorCode, RefreshAxiosInstance, toApiError, unwrap } from '../network';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '../../../utils/storage_utils/storageUtils';
import {
  clearIntentionalSignOut,
  markIntentionalSignOut,
  setBusinessStatusStaleHandler,
  setSessionExpiredHandler,
} from '../../../utils/auth-events/authEvents';

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
    return Promise.resolve(respond(config, 200, { success: true, data: { url: config.url } }));
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
    MainAxiosInstance.defaults.adapter = tokenServer as never;
    expired.mockReset();
    setSessionExpiredHandler(expired);
    refreshSpy = jest.spyOn(RefreshAxiosInstance, 'post').mockImplementation(async () => {
      await delay(20); // keep the refresh in flight while the others arrive
      return { data: { data: { accessToken: 'access-2', refreshToken: 'refresh-2' } } };
    });
  });

  afterEach(() => {
    refreshSpy.mockRestore();
    setSessionExpiredHandler(null);
  });

  it('two concurrent 401s trigger exactly ONE refresh, and both requests succeed', async () => {
    const [a, b] = await Promise.all([MainAxiosInstance.get('/orders'), MainAxiosInstance.get('/profile')]);

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
    await MainAxiosInstance.get('/orders');
    expect(refreshSpy.mock.calls[0][0]).toBe('/auth/refresh-token');
    expect(await getRefreshToken()).toBe('refresh-2');
  });

  it('a refresh answered without both tokens ends the session (the old refresh token is already spent)', async () => {
    refreshSpy.mockResolvedValue({ data: { data: { tokens: { accessToken: 'access-2', refreshToken: 'refresh-2' } } } });
    await expect(MainAxiosInstance.get('/orders')).rejects.toBeDefined();
    expect(expired).toHaveBeenCalledWith('REFRESH_INVALID');
    expect(await getRefreshToken()).toBeNull();
  });

  it.each([
    ['400 (a malformed token)', 400, 'VALIDATION_FAILED'],
    ['an unlisted 401', 401, 'UNAUTHORIZED'],
    ['404', 404, 'NOT_FOUND'],
  ])('a refresh refused with %s ends the session instead of failing every request forever', async (_n, status, code) => {
    refreshSpy.mockRejectedValue(serverSays(status, code));
    await expect(MainAxiosInstance.get('/orders')).rejects.toMatchObject({ code: 'REFRESH_INVALID' });
    expect(expired).toHaveBeenCalledWith('REFRESH_INVALID');
    expect(await getRefreshToken()).toBeNull();
  });

  it.each([
    ['408', 408],
    ['429', 429],
    ['503', 503],
  ])('a refresh that failed with %s keeps the session for the next try', async (_n, status) => {
    refreshSpy.mockRejectedValue(serverSays(status, 'X'));
    await expect(MainAxiosInstance.get('/orders')).rejects.toBeDefined();
    expect(expired).not.toHaveBeenCalled();
    expect(await getRefreshToken()).toBe('refresh-1');
  });

  it('five concurrent 401s still refresh once', async () => {
    await Promise.all(['/a', '/b', '/c', '/d', '/e'].map(u => MainAxiosInstance.get(u)));
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it('a definitively refused refresh rejects every queued request, clears tokens and announces expiry ONCE', async () => {
    refreshSpy.mockImplementation(async () => {
      await delay(20);
      throw serverSays(401, 'REFRESH_INVALID');
    });

    const results = await Promise.allSettled([MainAxiosInstance.get('/a'), MainAxiosInstance.get('/b'), MainAxiosInstance.get('/c')]);

    expect(results.every(r => r.status === 'rejected')).toBe(true);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(expired).toHaveBeenCalledTimes(1);
    expect(expired).toHaveBeenCalledWith('REFRESH_INVALID');
    expect(await getAccessToken()).toBeNull();
  });

  it('REFRESH_REUSED ends the session with its own reason (the security toast)', async () => {
    refreshSpy.mockRejectedValue(serverSays(401, 'REFRESH_REUSED'));
    const err = await MainAxiosInstance.get('/a').catch(e => e);
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
    await expect(MainAxiosInstance.get('/a')).rejects.toBeDefined();
    expect(expired).not.toHaveBeenCalled();
    expect(await getAccessToken()).toBe('access-1');
    expect(await getRefreshToken()).toBe('refresh-1');

    // The next request tries again and recovers.
    refreshSpy.mockResolvedValue({ data: { data: { accessToken: 'access-2', refreshToken: 'refresh-2' } } });
    await expect(MainAxiosInstance.get('/b')).resolves.toBeDefined();
  });

  it('does not refresh on auth routes — a 401 there is the real answer', async () => {
    await expect(MainAxiosInstance.post('/auth/signin', { email: 'a', password: 'b' })).rejects.toBeInstanceOf(AxiosError);
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('does not refresh or announce during an intentional sign-out', async () => {
    markIntentionalSignOut();
    await expect(MainAxiosInstance.get('/orders')).rejects.toBeInstanceOf(AxiosError);
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(expired).not.toHaveBeenCalled();
  });

  it('with no refresh token, the session ends without a network call', async () => {
    await clearTokens();
    await expect(MainAxiosInstance.get('/orders')).rejects.toBeDefined();
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(expired).toHaveBeenCalledTimes(1);
    expect(expired).toHaveBeenCalledWith('NO_REFRESH_TOKEN');
  });

  it('403 ACCOUNT_DISABLED on any request ends the session', async () => {
    MainAxiosInstance.defaults.adapter = ((config: InternalAxiosRequestConfig) =>
      Promise.reject(fail(config, 403, { error: { code: 'ACCOUNT_DISABLED', message: 'Disabled' } }))) as never;
    await expect(MainAxiosInstance.get('/orders')).rejects.toBeDefined();
    expect(expired).toHaveBeenCalledWith('ACCOUNT_DISABLED');
    expect(await getAccessToken()).toBeNull();
  });
});

describe('apiHelpers — status gates and errors', () => {
  it('403 BUSINESS_SUSPENDED fires the business-status-stale bridge', async () => {
    const stale = jest.fn();
    setBusinessStatusStaleHandler(stale);
    MainAxiosInstance.defaults.adapter = ((config: InternalAxiosRequestConfig) =>
      Promise.reject(fail(config, 403, { error: { code: 'BUSINESS_SUSPENDED', message: 'Paused' } }))) as never;

    await expect(MainAxiosInstance.get('/businesses/me')).rejects.toBeDefined();
    expect(stale).toHaveBeenCalledTimes(1);
    setBusinessStatusStaleHandler(null);
  });

  it('toApiError keeps message, code, status and details', async () => {
    MainAxiosInstance.defaults.adapter = ((config: InternalAxiosRequestConfig) =>
      Promise.reject(
        fail(config, 422, {
          error: { code: 'DOCUMENTS_MISSING', message: 'Upload your PMDC certificate', details: { missing: ['pmdc_certificate'] } },
        }),
      )) as never;
    const err = toApiError(await MainAxiosInstance.post('/businesses/me/submit').catch(e => e));
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      message: 'Upload your PMDC certificate',
      code: 'DOCUMENTS_MISSING',
      status: 422,
      details: { missing: ['pmdc_certificate'] },
    });
  });

  describe('no response at all: why, in words that are true', () => {
    const network = jest.requireMock('expo-network') as { getNetworkStateAsync: jest.Mock };
    const noResponse = (code = 'ERR_NETWORK', message = 'Network Error') => {
      const calls: string[] = [];
      MainAxiosInstance.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
        calls.push(`${config.method} ${config.url}`);
        return Promise.reject(new AxiosError(message, code, config, {}, undefined));
      }) as never;
      return calls;
    };

    it('says "offline" only when the device reports no connection', async () => {
      network.getNetworkStateAsync.mockResolvedValueOnce({ isConnected: false, isInternetReachable: false });
      noResponse();
      const err = toApiError(await MainAxiosInstance.get('/x').catch(e => e));
      expect(err).toMatchObject({ code: 'NETWORK_ERROR', details: { reason: 'offline' } });
      expect(err.message).toMatch(/You're offline/);
    });

    it('a timeout while online says MetroMatrix is slow, not offline, and is never repeated', async () => {
      const calls = noResponse('ECONNABORTED', 'timeout of 30000ms exceeded');
      const err = toApiError(await MainAxiosInstance.get('/x').catch(e => e));
      expect(extractErrorCode(err)).toBe('NETWORK_ERROR');
      expect(err.details).toMatchObject({ reason: 'timeout' });
      expect(err.message).toMatch(/taking longer than usual/);
      expect(err.message).not.toMatch(/offline/);
      expect(calls).toHaveLength(1);
    });

    it('a read that never reached the server is tried once more, then says it cannot reach MetroMatrix', async () => {
      const calls = noResponse();
      const err = toApiError(await MainAxiosInstance.get('/x').catch(e => e));
      expect(calls).toEqual(['get /x', 'get /x']);
      expect(err.details).toMatchObject({ reason: 'unreachable' });
      expect(err.message).toMatch(/can't reach MetroMatrix/);
      expect(err.message).not.toMatch(/offline/);
    });

    it('a write is never repeated', async () => {
      const calls = noResponse();
      await MainAxiosInstance.post('/auth/signup', {}).catch(e => e);
      expect(calls).toEqual(['post /auth/signup']);
    });

    it('a read that succeeds on its second try answers normally', async () => {
      let n = 0;
      MainAxiosInstance.defaults.adapter = ((config: InternalAxiosRequestConfig) =>
        n++ === 0
          ? Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK', config, {}, undefined))
          : Promise.resolve(respond(config, 200, { success: true, data: { ok: true } }))) as never;
      const res = await MainAxiosInstance.get('/x');
      expect(unwrap(res)).toEqual({ ok: true });
      expect(n).toBe(2);
    });
  });
});
