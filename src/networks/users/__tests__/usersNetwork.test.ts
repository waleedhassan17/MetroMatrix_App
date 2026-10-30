// B10 + B15: the users endpoints as the API defines them (users.controller.ts).

import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { api } from '../../network/apiHelpers';
import { registerDevice, unregisterDevice, updateMe } from '../usersNetwork';

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
  it('registerDevice: PUT /users/me/devices { expoPushToken, platform }', async () => {
    api.defaults.adapter = answer({ registered: true });
    await registerDevice('ExponentPushToken[abcdefghij123]', 'android');
    expect(sent[0]).toMatchObject({
      method: 'put',
      url: '/users/me/devices',
      body: { expoPushToken: 'ExponentPushToken[abcdefghij123]', platform: 'android' },
    });
  });

  it('unregisterDevice: DELETE /users/me/devices/:token (URL-encoded) with the captured token, reads { removed }', async () => {
    api.defaults.adapter = answer({ removed: true });
    const removed = await unregisterDevice('ExponentPushToken[abc/def]', 'captured-access');
    expect(sent[0]).toMatchObject({
      method: 'delete',
      url: '/users/me/devices/ExponentPushToken%5Babc%2Fdef%5D',
      auth: 'Bearer captured-access',
    });
    expect(removed).toBe(true);
  });

  it('unregisterDevice never throws, and says false when nothing was removed', async () => {
    api.defaults.adapter = answer({ removed: false });
    expect(await unregisterDevice('ExponentPushToken[gone12345678]', null)).toBe(false);
    api.defaults.adapter = (async () => {
      throw new Error('offline');
    }) as never;
    await expect(unregisterDevice('ExponentPushToken[x1234567890]', 'a')).resolves.toBe(false);
  });
});

describe('updateMe', () => {
  it('sends displayName (never name) and reads the bare user the API answers', async () => {
    api.defaults.adapter = answer({ id: 'u1', email: 'a@x.pk', displayName: 'Hina Raza', role: 'customer' });
    const user = await updateMe({ name: ' Hina Raza ', phone: null });
    expect(sent[0]).toMatchObject({ method: 'patch', url: '/users/me', body: { displayName: 'Hina Raza', phone: null } });
    expect(sent[0].body).not.toHaveProperty('name');
    expect(user.name).toBe('Hina Raza');
  });
});
