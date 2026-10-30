// B11 + C5: admin TOTP enrolment carries the challenge as the bearer with no
// token in the body; a dead challenge (401 UNAUTHORIZED, 429 RATE_LIMITED)
// sends the admin back to Sign In with a reason; TOTP_REQUIRED switches step.
// Staff signing in on the User door are retried on the admin door.

import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { api } from '../../../networks/network/apiHelpers';
import { adminTotpConfirm, adminTotpEnrol } from '../../../networks/admin/adminBusinessNetwork';
import authReducer, { setPendingTotp } from '../../Auth/authSlice';
import { signInSlice } from '../../Auth/SignIn/signInSlice';
import { adminTotpSlice, verifyTotpAsync } from '../AdminTotp/adminTotpSlice';
import { adminTwoFactorEnrolSlice, loadEnrolmentAsync } from '../AdminTwoFactorEnrol/adminTwoFactorEnrolSlice';
import { signInAndOpen } from '../../Auth/shared/authThunks';
import { doorForAccount } from '../../../models/authDoors';
import { clearTokens, getAccessToken } from '../../../utils/storageUtils';

type Sent = { url?: string; data?: unknown; auth?: string };
const sent: Sent[] = [];

const reply = (config: InternalAxiosRequestConfig, status: number, data: unknown): AxiosResponse => ({
  data,
  status,
  statusText: String(status),
  headers: {},
  config,
});

const server = (handle: (c: InternalAxiosRequestConfig, body: Record<string, unknown>) => AxiosResponse | Promise<never>) =>
  (async (config: InternalAxiosRequestConfig) => {
    const body = config.data ? JSON.parse(String(config.data)) : {};
    sent.push({ url: config.url, data: config.data, auth: String(config.headers?.Authorization ?? '') });
    return handle(config, body);
  }) as never;

const fail = (config: InternalAxiosRequestConfig, status: number, code: string, details?: object) => {
  const { AxiosError } = jest.requireActual('axios');
  return Promise.reject(
    new AxiosError('x', 'ERR_BAD_RESPONSE', config, null, reply(config, status, { error: { code, message: code, details } })),
  ) as Promise<never>;
};

const makeStore = () =>
  configureStore({
    reducer: combineReducers({
      auth: authReducer,
      signIn: signInSlice.reducer,
      adminTotp: adminTotpSlice.reducer,
      adminTwoFactorEnrol: adminTwoFactorEnrolSlice.reducer,
    }),
  });

const pending = { challengeToken: 'challenge-1', enrolled: true, email: 'admin@x.pk' };
const authResult = {
  user: { id: 'a1', email: 'admin@x.pk', role: 'super_admin', isEmailVerified: true },
  business: null,
  tokens: { accessToken: 'acc', refreshToken: 'ref', expiresIn: 900 },
};

const original = api.defaults.adapter;
beforeEach(async () => {
  sent.length = 0;
  await clearTokens();
});
afterAll(() => {
  api.defaults.adapter = original;
});

describe('enrolment requests', () => {
  it('enrol: POST /admin/me/totp/enrol with the challenge as bearer and no body', async () => {
    api.defaults.adapter = server(c =>
      reply(c, 200, { data: { otpauthUri: 'otpauth://totp/x?secret=S', qrDataUrl: 'data:image/png;base64,AA', secret: 'S' } }),
    );
    const enrolment = await adminTotpEnrol('challenge-1');
    expect(sent[0]).toMatchObject({ url: '/admin/me/totp/enrol', auth: 'Bearer challenge-1' });
    expect(sent[0].data).toBeUndefined();
    expect(enrolment).toEqual({ secret: 'S', otpauthUrl: 'otpauth://totp/x?secret=S', qrDataUrl: 'data:image/png;base64,AA' });
  });

  it('confirm: only { code } in the body; reads { recoveryCodes, auth } and stores the session', async () => {
    api.defaults.adapter = server(c => reply(c, 200, { data: { recoveryCodes: ['abcd-2345'], auth: authResult } }));
    const out = await adminTotpConfirm('challenge-1', '123456');
    expect(sent[0]).toMatchObject({ url: '/admin/me/totp/confirm', auth: 'Bearer challenge-1' });
    expect(JSON.parse(String(sent[0].data))).toEqual({ code: '123456' });
    expect(out.recoveryCodes).toEqual(['abcd-2345']);
    expect(out.result.user.role).toBe('super_admin');
    expect(await getAccessToken()).toBe('acc');
  });
});

describe('a dead challenge', () => {
  it.each([
    ['401 UNAUTHORIZED', 401, 'UNAUTHORIZED', /timed out/],
    ['429 RATE_LIMITED', 429, 'RATE_LIMITED', /Too many incorrect codes/],
  ])('%s at the code step ends it: back to Sign In with the reason', async (_n, status, code, copy) => {
    api.defaults.adapter = server(c => fail(c, status, code, { retryAfter: 600 }));
    const store = makeStore();
    store.dispatch(setPendingTotp(pending));
    await store.dispatch(verifyTotpAsync({ challengeToken: 'challenge-1', code: '000000' }));
    const s = store.getState();
    expect(s.auth.pendingTotp).toBeNull();
    expect(s.auth.signedOutLanding).toBe('SignIn');
    expect(s.signIn.error.message).toMatch(copy);
  });

  it('403 TOTP_REQUIRED at the code step moves to enrolment; at enrolment, back to the code step', async () => {
    api.defaults.adapter = server(c => fail(c, 403, 'TOTP_REQUIRED', { enrolmentRequired: true }));
    const store = makeStore();
    store.dispatch(setPendingTotp(pending));
    await store.dispatch(verifyTotpAsync({ challengeToken: 'challenge-1', code: '123456' }));
    expect(store.getState().auth.pendingTotp).toMatchObject({ enrolled: false });

    await store.dispatch(loadEnrolmentAsync('challenge-1'));
    expect(store.getState().auth.pendingTotp).toMatchObject({ enrolled: true });
  });
});

describe('staff on the User door', () => {
  it('WRONG_PORTAL for a staff account is retried on the admin door and opens the TOTP step', async () => {
    api.defaults.adapter = server((c, body) =>
      body.portal === 'admin'
        ? reply(c, 200, { data: { totpRequired: true, enrolmentRequired: false, challengeToken: 'challenge-2' } })
        : fail(c, 403, 'WRONG_PORTAL', { accountType: 'super_admin', portal: 'customer' }),
    );
    const store = makeStore();
    const outcome = await signInAndOpen(store.dispatch, 'customer', 'admin@x.pk', 'Secret123');
    expect(outcome).toBe('totp');
    expect(sent.map(s => JSON.parse(String(s.data)).portal)).toEqual(['customer', 'admin']);
    expect(store.getState().auth.pendingTotp).toMatchObject({ challengeToken: 'challenge-2', enrolled: true });
  });

  it('a partner on the User door is not retried', async () => {
    api.defaults.adapter = server(c => fail(c, 403, 'WRONG_PORTAL', { accountType: 'partner', portal: 'customer' }));
    await expect(signInAndOpen(makeStore().dispatch, 'customer', 'p@x.pk', 'Secret123')).rejects.toMatchObject({
      code: 'WRONG_PORTAL',
    });
    expect(sent).toHaveLength(1);
  });

  it('the right door follows from the account type', () => {
    expect(doorForAccount('partner')).toBe('partner');
    expect(doorForAccount('customer')).toBe('customer');
    expect(doorForAccount('super_admin')).toBe('customer');
    expect(doorForAccount('rider')).toBeUndefined();
  });
});
