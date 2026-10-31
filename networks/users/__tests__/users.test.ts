// B10 + B15: the users endpoints as the API defines them (users.controller.ts).
// Thin network functions (FinMatrix): the raw body back, the caller serializes.

import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { MainAxiosInstance, ApiError } from '../../network/network';
import { registerDevice, unregisterDevice, updateMe } from '../users';
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

const original = MainAxiosInstance.defaults.adapter;
beforeEach(() => {
  sent.length = 0;
});
afterAll(() => {
  MainAxiosInstance.defaults.adapter = original;
});

describe('devices', () => {
  it('registerDevice: PUT /users/me/devices { expoPushToken, platform }', async () => {
    MainAxiosInstance.defaults.adapter = answer({ registered: true });
    await registerDevice('ExponentPushToken[abcdefghij123]', 'android');
    expect(sent[0]).toMatchObject({
      method: 'put',
      url: '/users/me/devices',
      body: { expoPushToken: 'ExponentPushToken[abcdefghij123]', platform: 'android' },
    });
  });

  it('unregisterDevice: DELETE /users/me/devices/:token (URL-encoded) with the captured token, answers the raw body', async () => {
    MainAxiosInstance.defaults.adapter = answer({ removed: true });
    const raw = await unregisterDevice('ExponentPushToken[abc/def]', 'captured-access');
    expect(sent[0]).toMatchObject({
      method: 'delete',
      url: '/users/me/devices/ExponentPushToken%5Babc%2Fdef%5D',
      auth: 'Bearer captured-access',
    });
    expect(raw).toEqual({ success: true, data: { removed: true } });
  });

  it('unregisterDevice fails as an ApiError (sign-out treats it as best-effort)', async () => {
    MainAxiosInstance.defaults.adapter = (async () => {
      throw new Error('offline');
    }) as never;
    await expect(unregisterDevice('ExponentPushToken[x1234567890]', 'a')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('updateMe', () => {
  it('sends displayName (never name); userResponseSerializer reads the bare user the API answers', async () => {
    MainAxiosInstance.defaults.adapter = answer({ id: 'u1', email: 'a@x.pk', displayName: 'Hina Raza', role: 'customer' });
    const user = userResponseSerializer(await updateMe(updateMeBody({ name: ' Hina Raza ', phone: null })));
    expect(sent[0]).toMatchObject({ method: 'patch', url: '/users/me', body: { displayName: 'Hina Raza', phone: null } });
    expect(sent[0].body).not.toHaveProperty('name');
    expect(user.name).toBe('Hina Raza');
  });
});
