// As in FinMatrix, every build talks to the real API: a build with no backend
// URL is a configuration error that sends nothing, never a silent mock.

type Env = typeof import('../env');
type Helpers = typeof import('../../networks/network/apiHelpers');

// Restored key by key: replacing process.env itself would leave the modules
// reading the old object.
const KEYS = ['EXPO_PUBLIC_USE_MOCK_API', 'EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_SUPPORT_EMAIL'] as const;
const saved = Object.fromEntries(KEYS.map(k => [k, process.env[k]]));
const g = global as unknown as { __DEV__: boolean };
const savedDev = g.__DEV__;

const load = (opts: { dev: boolean; mock?: string; url?: string }) => {
  g.__DEV__ = opts.dev;
  if (opts.mock === undefined) delete process.env.EXPO_PUBLIC_USE_MOCK_API;
  else process.env.EXPO_PUBLIC_USE_MOCK_API = opts.mock;
  if (opts.url === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = opts.url;
  let env!: Env;
  let helpers!: Helpers;
  jest.isolateModules(() => {
    env = require('../env');
    helpers = require('../../networks/network/apiHelpers');
  });
  return { env, helpers };
};

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  g.__DEV__ = savedDev;
});

describe('env modes', () => {
  it('a build without a URL is a configuration error, whatever else is set', () => {
    expect(load({ dev: false }).env.CONFIG_ERROR).toBe(true);
    // The old dummy-API switch does nothing any more.
    expect(load({ dev: true, mock: '1' }).env.CONFIG_ERROR).toBe(true);
  });

  it('a build with a URL is configured and talks to it, with no adapter of its own', () => {
    for (const dev of [false, true]) {
      const { env, helpers } = load({ dev, mock: '1', url: ' https://api.example.com/api/v1 ' });
      expect(env).toMatchObject({ CONFIG_ERROR: false, API_BASE_URL: 'https://api.example.com/api/v1' });
      expect(helpers.api.defaults.baseURL).toBe('https://api.example.com/api/v1');
      expect(helpers.api.defaults.adapter).not.toEqual(expect.any(Function));
    }
  });

  it('with CONFIG_ERROR every request rejects with CONFIG_ERROR and nothing reaches the network', async () => {
    const { helpers } = load({ dev: false });
    const err = await helpers.api.get('/auth/me').catch((e: unknown) => e);
    expect(helpers.extractErrorCode(err)).toBe('CONFIG_ERROR');
    expect(helpers.isNetworkError(err)).toBe(false);
    const refresh = await helpers.refreshClient.post('/auth/refresh-token', { refreshToken: 'r' }).catch((e: unknown) => e);
    expect(helpers.extractErrorCode(refresh)).toBe('CONFIG_ERROR');
  });

  it('reads the support address from the environment', () => {
    process.env.EXPO_PUBLIC_SUPPORT_EMAIL = 'help@example.com';
    expect(load({ dev: true }).env.SUPPORT_EMAIL).toBe('help@example.com');
  });
});
