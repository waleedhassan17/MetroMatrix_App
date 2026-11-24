// Sign-up, safe to retry (screens/shared/authThunks.ts). The API saves the
// account before anything slow, so a sign-up that timed out — or a second tap
// told EMAIL_EXISTS — may have created it: the same email and password then
// sign in on the sign-up's own door and the person carries on.

import { combineReducers, configureStore } from '@reduxjs/toolkit';
import authReducer from '../../store/authSlice';
import { emailVerificationSlice } from '../email-verification-screen/emailVerificationSlice';
import { signUpAndOpen } from '../shared/authThunks';
import { ApiError } from '../../networks/network/network';
import { makeUser } from '../../__fixtures__/users';

jest.mock('../../networks/authcalls/signup', () => ({ authSignup: jest.fn() }));
jest.mock('../../networks/authcalls/signin', () => ({ authLogin: jest.fn() }));
const { authSignup } = jest.requireMock('../../networks/authcalls/signup') as { authSignup: jest.Mock };
const { authLogin } = jest.requireMock('../../networks/authcalls/signin') as { authLogin: jest.Mock };

const payload = { name: 'Sana', email: 'sana@example.com', phone: '', password: 'Secret123', portal: 'partner' as const };
const account = {
  user: makeUser({ email: 'sana@example.com', role: 'partner', isEmailVerified: false }),
  business: null,
  tokens: { accessToken: 'a', refreshToken: 'r' },
};

const makeStore = () =>
  configureStore({ reducer: combineReducers({ auth: authReducer, emailVerification: emailVerificationSlice.reducer }) });

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

const run = async (store: ReturnType<typeof makeStore>) => {
  const p = signUpAndOpen(store.dispatch, payload).catch(e => e);
  await jest.runAllTimersAsync();
  return p;
};

describe('signUpAndOpen', () => {
  it('opens the new session and starts the resend countdown', async () => {
    const store = makeStore();
    authSignup.mockResolvedValue(account);
    expect(await run(store)).toBeUndefined();
    expect(store.getState().auth.isAuthenticated).toBe(true);
    expect(store.getState().emailVerification.resendAvailableAt).toBeGreaterThan(Date.now());
    expect(authLogin).not.toHaveBeenCalled();
  });

  it('a sign-up that timed out but created the account carries on by signing in', async () => {
    const store = makeStore();
    authSignup.mockRejectedValue(new ApiError('slow', 'NETWORK_ERROR', undefined, { reason: 'timeout' }));
    authLogin.mockResolvedValue({ kind: 'session', result: account });
    expect(await run(store)).toBeUndefined();
    expect(authLogin).toHaveBeenCalledWith({ email: 'sana@example.com', password: 'Secret123', portal: 'partner' });
    expect(store.getState().auth.user?.email).toBe('sana@example.com');
  });

  it('a second tap told EMAIL_EXISTS carries on when the password is theirs', async () => {
    const store = makeStore();
    authSignup.mockRejectedValue(new ApiError('exists', 'EMAIL_EXISTS', 409));
    authLogin.mockResolvedValue({ kind: 'session', result: account });
    expect(await run(store)).toBeUndefined();
    expect(store.getState().auth.isAuthenticated).toBe(true);
  });

  it("someone else's address keeps EMAIL_EXISTS (\"Sign in instead\")", async () => {
    const store = makeStore();
    const exists = new ApiError('exists', 'EMAIL_EXISTS', 409);
    authSignup.mockRejectedValue(exists);
    authLogin.mockRejectedValue(new ApiError('wrong', 'INVALID_CREDENTIALS', 401));
    expect(await run(store)).toBe(exists);
    expect(store.getState().auth.isAuthenticated).toBe(false);
  });

  it('a timeout with no account yet keeps the timeout message', async () => {
    const store = makeStore();
    const slow = new ApiError('slow', 'NETWORK_ERROR', undefined, { reason: 'timeout' });
    authSignup.mockRejectedValue(slow);
    authLogin.mockRejectedValue(new ApiError('wrong', 'INVALID_CREDENTIALS', 401));
    expect(await run(store)).toBe(slow);
  });

  it('offline never tries: the sign-up never left the phone', async () => {
    const store = makeStore();
    const offline = new ApiError('off', 'NETWORK_ERROR', undefined, { reason: 'offline' });
    authSignup.mockRejectedValue(offline);
    expect(await run(store)).toBe(offline);
    expect(authLogin).not.toHaveBeenCalled();
  });

  it('a validation error is never retried as a sign-in', async () => {
    const store = makeStore();
    const invalid = new ApiError('bad', 'VALIDATION_FAILED', 400);
    authSignup.mockRejectedValue(invalid);
    expect(await run(store)).toBe(invalid);
    expect(authLogin).not.toHaveBeenCalled();
  });

  it('a staff account answering the recovery keeps the original error', async () => {
    const store = makeStore();
    const exists = new ApiError('exists', 'EMAIL_EXISTS', 409);
    authSignup.mockRejectedValue(exists);
    authLogin.mockResolvedValue({ kind: 'totp', challenge: { challengeToken: 't', totpEnrolled: true } });
    expect(await run(store)).toBe(exists);
  });
});
