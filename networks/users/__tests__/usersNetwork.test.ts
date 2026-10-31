// B10 + B15: the users endpoints as the API defines them (users.controller.ts).
// Thin network functions (FinMatrix): the raw body back, the caller serializes.

import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { api, ApiError } from '../../network/apiHelpers';
import { registerDeviceAPI, unregisterDeviceAPI, updateMeAPI } from '../usersNetwork';
import { updateMeBody } from '../../../models/authModel';
import { userResponseSerializer } from '../../../serializers/authSerializer';

type Sent = { method?: string; url?: string; body: unknown; auth?: string };
const sent: Sent[] = [];

const answer = (data: unknown) =>
  (async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    sent.push({
      method: config.method,
      url: config.url,
      body: config.data ? JSON.parse(String(config.data)) : undefined,
      auth: String(config.headers?.Authorization ?? ''),
    });
    return { data: { success: true, data }, status: 200, statusText: '200', headers: {}, config };
  }) as never;

const original = api.defaults.adapter;
beforeEach(() => {
  sent.length = 0;
});
afterAll(() => {
  api.defaults.adapter = original;
});

describe('devices', () => {
  it('registerDeviceAPI: PUT /users/me/devices { expoPushToken, platform }', async () => {
    api.defaults.adapter = answer({ registered: true });
    await registerDeviceAPI('ExponentPushToken[abcdefghij123]', 'android');
    expect(sent[0]).toMatchObject({
      method: 'put',
      url: '/users/me/devices',
      body: { expoPushToken: 'ExponentPushToken[abcdefghij123]', platform: 'android' },
    });
  });

  it('unregisterDeviceAPI: DELETE /users/me/devices/:token (URL-encoded) with the captured token, answers the raw body', async () => {
    api.defaults.adapter = answer({ removed: true });
    const raw = await unregisterDeviceAPI('ExponentPushToken[abc/def]', 'captured-access');
    expect(sent[0]).toMatchObject({
      method: 'delete',
      url: '/users/me/devices/ExponentPushToken%5Babc%2Fdef%5D',
      auth: 'Bearer captured-access',
    });
    expect(raw).toEqual({ success: true, data: { removed: true } });
  });

  it('unregisterDeviceAPI fails as an ApiError (sign-out treats it as best-effort)', async () => {
    api.defaults.adapter = (async () => {
      throw new Error('offline');
    }) as never;
    await expect(unregisterDeviceAPI('ExponentPushToken[x1234567890]', 'a')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('updateMeAPI', () => {
  it('sends displayName (never name); userResponseSerializer reads the bare user the API answers', async () => {
    api.defaults.adapter = answer({ id: 'u1', email: 'a@x.pk', displayName: 'Hina Raza', role: 'customer' });
    const user = userResponseSerializer(await updateMeAPI(updateMeBody({ name: ' Hina Raza ', phone: null })));
    expect(sent[0]).toMatchObject({ method: 'patch', url: '/users/me', body: { displayName: 'Hina Raza', phone: null } });
    expect(sent[0].body).not.toHaveProperty('name');
    expect(user.name).toBe('Hina Raza');
  });
});
