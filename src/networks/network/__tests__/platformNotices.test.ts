// The platform's switches as the client hears them: GET /config through its
// serializer, and the real API's refusals (503 MAINTENANCE, 503
// SERVICE_PAUSED, 403 SIGNUPS_PAUSED) from any request, which the client
// reports as platform notices (apiHelpers → authEvents → AppContainer).

import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { api, extractErrorCode, required } from '../apiHelpers';
import { getPlatformConfigAPI } from '../../config/configNetwork';
import { setPlatformNoticeHandler, type PlatformNotice } from '../../../utils/authEvents';
import { platformConfigSerializer } from '../../../serializers/platformConfigSerializer';

const respond = (config: InternalAxiosRequestConfig, status: number, data: unknown): AxiosResponse => ({
  data,
  status,
  statusText: String(status),
  headers: {},
  config,
});

/** The server: one answer for the next request. */
const serverAnswers = (status: number, body: unknown) => {
  api.defaults.adapter = config =>
    status < 400
      ? Promise.resolve(respond(config, status, body))
      : Promise.reject(new AxiosError(`HTTP ${status}`, 'ERR_BAD_RESPONSE', config, null, respond(config, status, body)));
};

const refusal = (code: string, details: Record<string, unknown>, message = code) => ({
  success: false,
  error: { code, message, details },
});

const failure = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error('expected the call to fail');
};

const notices: PlatformNotice[] = [];
const savedAdapter = api.defaults.adapter;

beforeEach(() => {
  notices.length = 0;
  setPlatformNoticeHandler(n => notices.push(n));
});
afterAll(() => {
  setPlatformNoticeHandler(null);
  api.defaults.adapter = savedAdapter;
});

describe('GET /config', () => {
  it('reads the real shape (MetroMatrix API settings-schema.ts publicConfig)', async () => {
    serverAnswers(200, {
      success: true,
      data: {
        signupsEnabled: { customer: true, partner: false },
        services: {
          shopping: { enabled: true },
          healthcare: { enabled: false },
          food: { enabled: true },
          kitchen: { enabled: true },
        },
        ai: { enabled: true },
        maintenance: { enabled: false, message: 'Back soon.' },
        support: { email: 'help@metromatrix.app' },
      },
    });
    expect(required(platformConfigSerializer(await getPlatformConfigAPI()))).toEqual({
      signupsEnabled: { customer: true, partner: false },
      services: { shopping: true, healthcare: false, food: true, kitchen: true },
      aiEnabled: true,
      maintenance: { enabled: false, message: 'Back soon.' },
      supportEmail: 'help@metromatrix.app',
    });
  });

  it('reads anything missing as open', async () => {
    serverAnswers(200, { success: true, data: {} });
    const config = required(platformConfigSerializer(await getPlatformConfigAPI()));
    expect(config.signupsEnabled).toEqual({ customer: true, partner: true });
    expect(config.services).toEqual({ shopping: true, healthcare: true, food: true, kitchen: true });
    expect(config.maintenance.enabled).toBe(false);
  });
});

describe('refusals from any request become platform notices', () => {
  it('503 MAINTENANCE', async () => {
    serverAnswers(503, refusal('MAINTENANCE', { message: 'Back at 3 pm.' }));
    const e = await failure(api.get('/shop/home'));
    expect(extractErrorCode(e)).toBe('MAINTENANCE');
    expect(notices).toEqual([{ kind: 'maintenance', message: 'Back at 3 pm.' }]);
  });

  it('503 SERVICE_PAUSED names its service', async () => {
    serverAnswers(503, refusal('SERVICE_PAUSED', { service: 'shopping' }));
    await failure(api.get('/shop/home'));
    expect(notices).toEqual([{ kind: 'service_paused', service: 'shopping' }]);
  });

  it('403 SIGNUPS_PAUSED names its role', async () => {
    serverAnswers(403, refusal('SIGNUPS_PAUSED', { role: 'customer' }));
    const e = await failure(api.post('/auth/signup', {}));
    expect(extractErrorCode(e)).toBe('SIGNUPS_PAUSED');
    expect(notices).toEqual([{ kind: 'signups_paused', role: 'customer' }]);
  });

  it('other refusals are not notices', async () => {
    serverAnswers(503, refusal('SERVICE_PAUSED', { service: 'unknown' }));
    await failure(api.get('/shop/home'));
    serverAnswers(403, refusal('FORBIDDEN', {}));
    await failure(api.get('/shop/home'));
    expect(notices).toEqual([]);
  });
});
