// B6: only the server saying so ends a session. Offline, 5xx and 429 keep
// the tokens — at cold start too, where they show the offline/server gate.

import { AxiosError } from 'axios';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { ApiError, isDefinitiveSessionFailure, isTransient, NO_REFRESH_TOKEN } from '../apiHelpers';
import { appContainerSlice, bootstrapSession } from '../../../components/app-container/appContainerSlice';
import { sessionEndedCopy } from '../../../components/app-container/sessionEndedCopy';
import authReducer from '../../../screens/Auth/authSlice';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '../../../utils/storageUtils';
import { makeUser } from '../../../__fixtures__/users';

jest.mock('../../auth/authNetwork', () => ({ authMe: jest.fn() }));
jest.mock('../apiHelpers', () => ({
  ...jest.requireActual('../apiHelpers'),
  refreshTokens: jest.fn(),
}));
const { authMe } = jest.requireMock('../../auth/authNetwork') as { authMe: jest.Mock };
const { refreshTokens } = jest.requireMock('../apiHelpers') as { refreshTokens: jest.Mock };

const http = (status: number, code?: string) =>
  new AxiosError(`HTTP ${status}`, 'ERR_BAD_RESPONSE', {} as never, null, {
    data: code ? { error: { code } } : '<!DOCTYPE html>',
    status,
    statusText: String(status),
    headers: {},
    config: {} as never,
  });
const offline = () => new AxiosError('Network Error', 'ERR_NETWORK', {} as never, {}, undefined);

describe('isDefinitiveSessionFailure', () => {
  it.each([
    ['401 REFRESH_INVALID', http(401, 'REFRESH_INVALID')],
    ['401 REFRESH_REUSED', http(401, 'REFRESH_REUSED')],
    ['401 TOKEN_REVOKED', http(401, 'TOKEN_REVOKED')],
    ['403 ACCOUNT_DISABLED', http(403, 'ACCOUNT_DISABLED')],
    ['no refresh token', new ApiError('x', NO_REFRESH_TOKEN, 401)],
    ['an ApiError carrying REFRESH_REUSED', new ApiError('x', 'REFRESH_REUSED', 401)],
  ])('%s ends the session', (_n, err) => {
    expect(isDefinitiveSessionFailure(err)).toBe(true);
  });

  it.each([
    ['offline', offline()],
    ['503 (HTML error page)', http(503)],
    ['500', http(500, 'INTERNAL_ERROR')],
    ['429', http(429, 'RATE_LIMITED')],
    ['401 UNAUTHORIZED (an expired access token)', http(401, 'UNAUTHORIZED')],
    ['403 FORBIDDEN', http(403, 'FORBIDDEN')],
    ['a plain Error', new Error('boom')],
  ])('%s does not', (_n, err) => {
    expect(isDefinitiveSessionFailure(err)).toBe(false);
  });

  it('isTransient: offline, 5xx and 429 only', () => {
    expect([offline(), http(503), http(500, 'X'), http(429, 'RATE_LIMITED')].every(isTransient)).toBe(true);
    expect([http(401, 'REFRESH_INVALID'), http(400, 'VALIDATION_FAILED')].some(isTransient)).toBe(false);
  });
});

describe('bootstrapSession', () => {
  const makeStore = () =>
    configureStore({ reducer: combineReducers({ auth: authReducer, appContainer: appContainerSlice.reducer }) });
  const session = { user: makeUser({ isEmailVerified: true }), business: null };

  beforeEach(async () => {
    jest.clearAllMocks();
    await clearTokens();
  });

  it('restores a session', async () => {
    await setTokens('a', 'r');
    authMe.mockResolvedValue(session);
    const store = makeStore();
    await store.dispatch(bootstrapSession());
    expect(store.getState().auth.isAuthenticated).toBe(true);
    expect(store.getState().appContainer.networkIsDown).toBe(false);
  });

  it('a 503 at cold start keeps the tokens and shows the server-down gate, not Welcome', async () => {
    await setTokens('a', 'r');
    authMe.mockRejectedValue(http(503));
    const store = makeStore();
    await store.dispatch(bootstrapSession());
    expect(store.getState().appContainer).toMatchObject({ isAppReady: true, networkIsDown: true, downReason: 'server' });
    expect(await getAccessToken()).toBe('a');
    expect(await getRefreshToken()).toBe('r');
  });

  it('offline at cold start: the offline gate, tokens kept', async () => {
    await setTokens('a', 'r');
    authMe.mockRejectedValue(offline());
    const store = makeStore();
    await store.dispatch(bootstrapSession());
    expect(store.getState().appContainer).toMatchObject({ networkIsDown: true, downReason: 'offline' });
    expect(await getRefreshToken()).toBe('r');
  });

  it('a definitive failure signs out and clears the tokens', async () => {
    await setTokens('a', 'r');
    authMe.mockRejectedValue(http(401, 'REFRESH_REUSED'));
    const store = makeStore();
    await store.dispatch(bootstrapSession());
    expect(store.getState().auth.isAuthenticated).toBe(false);
    expect(store.getState().appContainer.networkIsDown).toBe(false);
    expect(await getRefreshToken()).toBeNull();
  });

  it('no access token but a refresh token: refresh first, then restore', async () => {
    // Only the access token is gone.
    await setTokens('', 'r');
    refreshTokens.mockResolvedValue('a2');
    authMe.mockResolvedValue(session);
    const store = makeStore();
    await store.dispatch(bootstrapSession());
    expect(refreshTokens).toHaveBeenCalledTimes(1);
    expect(store.getState().auth.isAuthenticated).toBe(true);
  });

  it('nothing stored at all: signed out without a request', async () => {
    const store = makeStore();
    await store.dispatch(bootstrapSession());
    expect(authMe).not.toHaveBeenCalled();
    expect(store.getState().auth.isAuthenticated).toBe(false);
  });
});

describe('sign-out toast', () => {
  it('REFRESH_REUSED says it was for security', () => {
    expect(sessionEndedCopy('REFRESH_REUSED').text2).toBe('You were signed out for security. Please sign in again.');
    expect(sessionEndedCopy('ACCOUNT_DISABLED').text1).toBe('Account disabled');
    expect(sessionEndedCopy('NO_REFRESH_TOKEN').text1).toBe('Session expired');
  });
});
