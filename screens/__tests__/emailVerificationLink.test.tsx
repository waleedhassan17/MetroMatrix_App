// B4: the link flow. The waiting screen re-reads the account (poll, foreground
// re-check, back-off, one request at a time) and never signs out on an error;
// the deep-link handler spends a token, or nothing for ?verified=1, and checks
// the account before it reports a failure.

import React from 'react';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { AppState } from 'react-native';
import authReducer from '../../store/authSlice';
import {
  checkVerifiedAsync,
  emailVerificationSlice,
  markManualCheck,
  nextPollDelay,
  nextResendKey,
  resendAsync,
} from '../email-verification-screen/emailVerificationSlice';
import { useVerificationPolling } from '../email-verification-screen/useVerificationPolling';
import { continueAsync, verifyLinkAsync, verifySuccessSlice } from '../verify-success-screen/verifySuccessSlice';
import { rewriteVerifyPath } from '../../navigators/linkingPaths';
import { ApiError } from '../../networks/network/network';
import { clearTokens, setTokens } from '../../utils/storage_utils/storageUtils';
import { makeUser } from '../../__fixtures__/users';

jest.mock('../../networks/authcalls/me', () => ({ me: jest.fn() }));
jest.mock('../../networks/authcalls/verifyEmail', () => ({
  verifyEmail: jest.fn(),
  resendVerification: jest.fn(),
}));
// Focus is the screen's concern; here the effect simply runs while mounted.
jest.mock('@react-navigation/native', () => {
  const { useEffect } = jest.requireActual('react');
  return { useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]) };
});

const network = {
  ...(jest.requireMock('../../networks/authcalls/me') as { me: jest.Mock }),
  ...(jest.requireMock('../../networks/authcalls/verifyEmail') as { verifyEmail: jest.Mock; resendVerification: jest.Mock }),
};

const unverified = { user: makeUser({ isEmailVerified: false }), business: null };
const verified = { user: makeUser({ isEmailVerified: true }), business: null };

const makeStore = () =>
  configureStore({
    reducer: combineReducers({
      auth: authReducer,
      emailVerification: emailVerificationSlice.reducer,
      verifySuccess: verifySuccessSlice.reducer,
    }),
  });

beforeEach(async () => {
  jest.clearAllMocks();
  await clearTokens();
});

describe('polling back-off', () => {
  it('waits 5 → 10 → 20 → 30 s after consecutive failures, never longer', () => {
    expect([0, 1, 2, 3, 4, 9].map(nextPollDelay)).toEqual([5000, 10000, 20000, 30000, 30000, 30000]);
  });
});

describe('checkVerifiedAsync', () => {
  it('moves the session on once the account says verified', async () => {
    const store = makeStore();
    await setTokens('a', 'r');
    network.me.mockResolvedValue(verified);
    await store.dispatch(checkVerifiedAsync({ silent: true }));
    expect(store.getState().auth.user?.isEmailVerified).toBe(true);
    expect(store.getState().emailVerification.autoSignIn).toBe(true);
  });

  it('a failed check counts toward the back-off, shows nothing when silent, and never signs out', async () => {
    const store = makeStore();
    store.dispatch({ type: 'auth/setSession', payload: unverified });
    network.me.mockRejectedValue(new ApiError('Server is temporarily unavailable.', undefined, 503));
    await store.dispatch(checkVerifiedAsync({ silent: true }));
    await store.dispatch(checkVerifiedAsync({ silent: true }));
    expect(store.getState().emailVerification).toMatchObject({ failures: 2, error: { message: '' } });
    expect(store.getState().auth.isAuthenticated).toBe(true);

    network.me.mockResolvedValue(unverified);
    await store.dispatch(checkVerifiedAsync({ silent: true }));
    expect(store.getState().emailVerification.failures).toBe(0);
  });

  it('only one check is on the wire at a time', async () => {
    const store = makeStore();
    let release!: (v: unknown) => void;
    network.me.mockReturnValue(new Promise(r => (release = r)));
    const a = store.dispatch(checkVerifiedAsync({ silent: true }));
    const b = store.dispatch(checkVerifiedAsync({ silent: false }));
    release(unverified);
    await Promise.all([a, b]);
    expect(network.me).toHaveBeenCalledTimes(1);
  });
});

describe('checkVerifiedAsync after sign-out and during a quiet check', () => {
  it('a verified answer that lands after sign-out does not bring the session back', async () => {
    const store = makeStore();
    network.me.mockResolvedValue(verified); // no tokens stored: signed out meanwhile
    const r = await store.dispatch(checkVerifiedAsync({ silent: true }));
    expect(r.payload).toBe(false);
    expect(store.getState().auth.isAuthenticated).toBe(false);
  });

  it('"I Verified My Email" during a quiet check is not dropped: that check reports to the person', async () => {
    const store = makeStore();
    let release!: (v: unknown) => void;
    network.me.mockReturnValue(new Promise(r => (release = r)));
    const quiet = store.dispatch(checkVerifiedAsync({ silent: true }));
    store.dispatch(markManualCheck());
    expect(store.getState().emailVerification.status).toBe('loading');
    release(unverified);
    await quiet;
    expect(store.getState().emailVerification).toMatchObject({
      status: 'failed',
      manual: false,
      error: { code: 'NOT_VERIFIED' },
    });
  });

  it('a timed-out manual check says MetroMatrix is slow, never "offline"', async () => {
    const store = makeStore();
    network.me.mockRejectedValue(new ApiError('x', 'NETWORK_ERROR', undefined, { reason: 'timeout' }));
    await store.dispatch(checkVerifiedAsync({ silent: false }));
    const { message } = store.getState().emailVerification.error;
    expect(message).toMatch(/taking longer than usual/);
    expect(message).not.toMatch(/offline/);
  });
});

describe('resendAsync', () => {
  it('RESEND_COOLDOWN restarts the countdown from retryAfter', async () => {
    const store = makeStore();
    network.resendVerification.mockRejectedValue(new ApiError('Wait', 'RESEND_COOLDOWN', 429, { retryAfter: 42 }));
    const before = Date.now();
    await store.dispatch(resendAsync({ key: 'k1' }));
    const at = store.getState().emailVerification.resendAvailableAt;
    expect(at - before).toBeGreaterThanOrEqual(41_000);
    expect(at - before).toBeLessThanOrEqual(43_000);
  });

  it('already verified: re-reads the account instead of waiting', async () => {
    const store = makeStore();
    await setTokens('a', 'r');
    network.resendVerification.mockResolvedValue({ retryAfter: 0, alreadyVerified: true });
    network.me.mockResolvedValue(verified);
    await store.dispatch(resendAsync({ key: 'k1' }));
    expect(store.getState().auth.user?.isEmailVerified).toBe(true);
  });

  it('already verified but the re-read fails: still a success, the poll moves on', async () => {
    const store = makeStore();
    network.resendVerification.mockResolvedValue({ retryAfter: 0, alreadyVerified: true });
    network.me.mockRejectedValue(new ApiError('x', 'NETWORK_ERROR', undefined, { reason: 'unreachable' }));
    const r = await store.dispatch(resendAsync({ key: 'k1' }));
    expect(resendAsync.fulfilled.match(r)).toBe(true);
    expect(store.getState().emailVerification.error.message).toBe('');
  });

  it('sends the Idempotency-Key, keeps it when nothing came back and drops it once answered', async () => {
    const store = makeStore();
    network.resendVerification.mockRejectedValueOnce(new ApiError('x', 'NETWORK_ERROR', undefined, { reason: 'timeout' }));
    await store.dispatch(resendAsync({ key: 'k1' }));
    expect(network.resendVerification).toHaveBeenLastCalledWith('k1');
    expect(nextResendKey(store.getState().emailVerification)).toBe('k1');

    network.resendVerification.mockResolvedValueOnce({ retryAfter: 60, alreadyVerified: false });
    await store.dispatch(resendAsync({ key: nextResendKey(store.getState().emailVerification) }));
    expect(network.resendVerification).toHaveBeenLastCalledWith('k1');
    expect(store.getState().emailVerification.resendKey).toBeNull();
    expect(nextResendKey(store.getState().emailVerification)).not.toBe('k1');
  });

  it('RATE_LIMITED (5 resends an hour) also starts the countdown', async () => {
    const store = makeStore();
    network.resendVerification.mockRejectedValue(new ApiError('Too many', 'RATE_LIMITED', 429, { retryAfter: 900 }));
    const before = Date.now();
    await store.dispatch(resendAsync({ key: 'k2' }));
    expect(store.getState().emailVerification.resendAvailableAt - before).toBeGreaterThanOrEqual(899_000);
    expect(store.getState().emailVerification.resendKey).toBeNull();
  });
});

describe('useVerificationPolling', () => {
  const Probe: React.FC<{ failures: number; done: boolean }> = ({ failures, done }) => {
    useVerificationPolling(failures, done);
    return null;
  };

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const flush = async (ms: number) => {
    await act(async () => {
      jest.advanceTimersByTime(ms);
      await Promise.resolve();
    });
  };

  it('re-checks every 5 s, on returning to the foreground, and stops when unmounted', async () => {
    const store = makeStore();
    network.me.mockResolvedValue(unverified);
    let listener: ((s: string) => void) | undefined;
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, fn) => {
      listener = fn as (s: string) => void;
      return { remove } as never;
    });

    let tree!: ReturnType<typeof create>;
    await act(async () => {
      tree = create(
        <Provider store={store}>
          <Probe failures={0} done={false} />
        </Provider>,
      );
    });
    expect(network.me).not.toHaveBeenCalled();
    await flush(5000);
    expect(network.me).toHaveBeenCalledTimes(1);
    await flush(5000);
    expect(network.me).toHaveBeenCalledTimes(2);

    await act(async () => listener?.('active'));
    expect(network.me).toHaveBeenCalledTimes(3);

    await act(async () => tree.unmount());
    await flush(30000);
    expect(network.me).toHaveBeenCalledTimes(3);
    expect(remove).toHaveBeenCalled();
  });

  it('does not poll once verified', async () => {
    const store = makeStore();
    await act(async () => {
      create(
        <Provider store={store}>
          <Probe failures={0} done />
        </Provider>,
      );
    });
    await flush(30000);
    expect(network.me).not.toHaveBeenCalled();
  });
});

describe('verifyLinkAsync (the deep-link handler)', () => {
  it('?token= spends it; signed in, the account is re-read and the gate moves on', async () => {
    const store = makeStore();
    await setTokens('a', 'r');
    network.verifyEmail.mockResolvedValue(verified);
    network.me.mockResolvedValue(verified);
    const r = await store.dispatch(verifyLinkAsync({ token: 'tok' }));
    expect(network.verifyEmail).toHaveBeenCalledWith('tok');
    expect(r.payload).toMatchObject({ signedIn: true, outcome: 'moved' });
    expect(store.getState().auth.user?.isEmailVerified).toBe(true);
  });

  it('?verified=1 spends nothing', async () => {
    const store = makeStore();
    await setTokens('a', 'r');
    network.me.mockResolvedValue(verified);
    await store.dispatch(verifyLinkAsync({ verified: true }));
    expect(network.verifyEmail).not.toHaveBeenCalled();
    expect(store.getState().verifySuccess.status).toBe('succeeded');
  });

  it('signed out: verified, and the screen offers Sign In', async () => {
    const store = makeStore();
    network.verifyEmail.mockResolvedValue(verified);
    await store.dispatch(verifyLinkAsync({ token: 'tok' }));
    expect(store.getState().verifySuccess).toMatchObject({ status: 'succeeded', signedIn: false });
    expect(network.me).not.toHaveBeenCalled();
  });

  it('a failed token, signed in, re-reads the account before reporting a failure', async () => {
    const store = makeStore();
    await setTokens('a', 'r');
    network.verifyEmail.mockRejectedValue(new ApiError('Expired', 'VERIFY_LINK_INVALID', 400));
    network.me.mockResolvedValue(verified);
    await store.dispatch(verifyLinkAsync({ token: 'spent' }));
    expect(store.getState().verifySuccess.status).toBe('succeeded');

    network.me.mockResolvedValue(unverified);
    await store.dispatch(verifyLinkAsync({ token: 'spent' }));
    expect(store.getState().verifySuccess).toMatchObject({
      status: 'failed',
      retryable: false,
      error: { code: 'VERIFY_LINK_INVALID' },
    });
  });

  it('signed out, a provider\'s link leads to the provider sign-in', async () => {
    const store = makeStore();
    network.verifyEmail.mockResolvedValue({ user: makeUser({ role: 'partner', isEmailVerified: true }), business: null });
    await store.dispatch(verifyLinkAsync({ token: 'tok' }));
    expect(store.getState().verifySuccess).toMatchObject({ outcome: 'done', role: 'partner' });
  });

  it('no answer while spending the link: retryable, and "Try again" spends the same token', async () => {
    const store = makeStore();
    network.verifyEmail.mockRejectedValueOnce(new ApiError('x', 'NETWORK_ERROR', undefined, { reason: 'timeout' }));
    await store.dispatch(verifyLinkAsync({ token: 'tok' }));
    const failed = store.getState().verifySuccess;
    expect(failed).toMatchObject({ status: 'failed', retryable: true });
    expect(failed.error.message).toMatch(/taking longer than usual/);

    network.verifyEmail.mockResolvedValueOnce(verified);
    await store.dispatch(verifyLinkAsync({ token: 'tok' }));
    expect(network.verifyEmail).toHaveBeenLastCalledWith('tok');
    expect(store.getState().verifySuccess).toMatchObject({ status: 'succeeded', outcome: 'done' });
  });

  it('verified but the account could not be read: "Continue" re-reads it and the gate moves on', async () => {
    const store = makeStore();
    await setTokens('a', 'r');
    network.verifyEmail.mockResolvedValue(verified);
    network.me.mockRejectedValueOnce(new ApiError('x', 'NETWORK_ERROR', undefined, { reason: 'unreachable' }));
    await store.dispatch(verifyLinkAsync({ token: 'tok' }));
    expect(store.getState().verifySuccess.outcome).toBe('unreadable');
    expect(store.getState().auth.isAuthenticated).toBe(false);

    network.me.mockResolvedValueOnce(verified);
    await store.dispatch(continueAsync());
    expect(store.getState().verifySuccess.outcome).toBe('moved');
    expect(store.getState().auth.user?.isEmailVerified).toBe(true);
  });

  it('?verified=1 while the account still reads unverified says "checking", never "verified"', async () => {
    const store = makeStore();
    await setTokens('a', 'r');
    network.me.mockResolvedValue(unverified);
    await store.dispatch(verifyLinkAsync({ verified: true }));
    expect(store.getState().verifySuccess.outcome).toBe('unconfirmed');
  });
});

describe('deep-link paths', () => {
  it('verify-success is rewritten to verify-email, query kept', () => {
    expect(rewriteVerifyPath('verify-success?token=abc')).toBe('verify-email?token=abc');
    expect(rewriteVerifyPath('/verify-success?verified=1')).toBe('/verify-email?verified=1');
    expect(rewriteVerifyPath('verify-email?token=abc')).toBe('verify-email?token=abc');
    expect(rewriteVerifyPath('verify-successful')).toBe('verify-successful');
  });
});
