// B7 + B8: changing the password stores the API's new pair before anything
// else and replaces the session from /auth/me (a partner stays a partner);
// Google-only accounts prove themselves with a fresh Google ID token, for
// both the first password and deletion.

import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { MainAxiosInstance } from '../../network/network';
import { changePassword } from '../changePassword';
import { deleteAccount } from '../deleteAccount';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '../../../utils/storage_utils/storageUtils';
import authReducer, { setSession } from '../../../store/authSlice';
import { changePasswordAsync, changePasswordSlice } from '../../../screens/change-password-screen/changePasswordSlice';
import { deleteAccountAsync, profileSlice } from '../../../screens/profile-screen/profileSlice';
import { makeUser } from '../../../__fixtures__/users';

jest.mock('../../../services/googleAuth', () => ({ getGoogleIdToken: jest.fn() }));
const { getGoogleIdToken } = jest.requireMock('../../../services/googleAuth') as { getGoogleIdToken: jest.Mock };

type Sent = { method?: string; url?: string; body: Record<string, unknown> | undefined; auth?: string };
const sent: Sent[] = [];

const partner = { id: 'u1', email: 'p@x.pk', displayName: 'Sara', role: 'partner', isEmailVerified: true, hasPassword: true };
const business = { id: 'b1', subType: 'doctor', serviceType: 'healthcare', status: 'approved', name: 'Clinic' };

/** The API: change-password answers a new pair; /auth/me only accepts it. */
const server = (async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
  const auth = String(config.headers?.Authorization ?? '');
  sent.push({ method: config.method, url: config.url, body: config.data ? JSON.parse(String(config.data)) : undefined, auth });
  const ok = (data: unknown) => ({ data: { success: true, data }, status: 200, statusText: '200', headers: {}, config });
  if (config.url === '/auth/change-password') {
    return ok({ changed: true, tokens: { accessToken: 'access-NEW', refreshToken: 'refresh-NEW', expiresIn: 900 } });
  }
  if (config.url === '/auth/me' && auth === 'Bearer access-NEW') return ok({ user: partner, business });
  if (config.url === '/auth/account') return ok({ deleted: true });
  throw Object.assign(new Error('unexpected'), { config });
}) as never;

const makeStore = () =>
  configureStore({
    reducer: combineReducers({
      auth: authReducer,
      changePassword: changePasswordSlice.reducer,
      profile: profileSlice.reducer,
    }),
  });

const original = MainAxiosInstance.defaults.adapter;
beforeEach(async () => {
  sent.length = 0;
  getGoogleIdToken.mockReset();
  MainAxiosInstance.defaults.adapter = server;
  await setTokens('access-OLD', 'refresh-OLD');
});
afterAll(async () => {
  MainAxiosInstance.defaults.adapter = original;
  await clearTokens();
});

describe('changePassword', () => {
  it('stores the new pair, then re-reads the account with it', async () => {
    const session = await changePassword({ currentPassword: 'Old1pass', newPassword: 'New1pass' });
    expect(sent[0]).toMatchObject({ url: '/auth/change-password', body: { currentPassword: 'Old1pass', newPassword: 'New1pass' } });
    expect(await getAccessToken()).toBe('access-NEW');
    expect(await getRefreshToken()).toBe('refresh-NEW');
    expect(sent[1]).toMatchObject({ url: '/auth/me', auth: 'Bearer access-NEW' });
    expect(session.user.role).toBe('partner');
  });

  it('a response without tokens is refused and leaves the stored pair alone', async () => {
    MainAxiosInstance.defaults.adapter = (async (config: InternalAxiosRequestConfig) => ({
      data: { data: { changed: true } },
      status: 200,
      statusText: '200',
      headers: {},
      config,
    })) as never;
    await expect(changePassword({ currentPassword: 'a', newPassword: 'B1bbbbbb' })).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
    expect(await getAccessToken()).toBe('access-OLD');
  });
});

describe('changePasswordAsync', () => {
  it('regression: a partner is still a partner, with their business, afterwards', async () => {
    const store = makeStore();
    store.dispatch(setSession({ user: makeUser({ id: 'u1', role: 'partner' }), business: null }));
    await store.dispatch(changePasswordAsync({ currentPassword: 'Old1pass', newPassword: 'New1pass' }));
    const { auth } = store.getState();
    expect(auth.user?.role).toBe('partner');
    expect(auth.business?.id).toBe('b1');
    expect(store.getState().changePassword.status).toBe('succeeded');
  });

  it('Google-only: asks Google for a fresh ID token and sends it, never an empty current password', async () => {
    getGoogleIdToken.mockResolvedValue('google-id-token');
    const store = makeStore();
    await store.dispatch(changePasswordAsync({ newPassword: 'First1pass' }));
    expect(sent[0].body).toEqual({ idToken: 'google-id-token', newPassword: 'First1pass' });
  });

  it('Google-only, cancelled: nothing is sent', async () => {
    getGoogleIdToken.mockResolvedValue(null);
    const store = makeStore();
    await store.dispatch(changePasswordAsync({ newPassword: 'First1pass' }));
    expect(sent).toHaveLength(0);
    expect(store.getState().changePassword.error.code).toBe('GOOGLE_CANCELLED');
  });
});

describe('delete account', () => {
  it('sends { password } with a password account', async () => {
    await deleteAccount({ password: 'Secret123' });
    expect(sent[0]).toMatchObject({ method: 'delete', url: '/auth/account', body: { password: 'Secret123' } });
    expect(await getAccessToken()).toBeNull();
  });

  it('a Google-only account sends a fresh { idToken }; { confirm: "DELETE" } is gone', async () => {
    getGoogleIdToken.mockResolvedValue('google-id-token');
    const store = makeStore();
    await store.dispatch(deleteAccountAsync({ google: true }));
    expect(sent[0].body).toEqual({ idToken: 'google-id-token' });
    expect(store.getState().auth.isAuthenticated).toBe(false);
  });
});
