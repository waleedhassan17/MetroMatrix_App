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
  nextPollDelay,
  resendAsync,
} from '../email-verification-screen/emailVerificationSlice';
import { useVerificationPolling } from '../email-verification-screen/useVerificationPolling';
import { verifyLinkAsync, verifySuccessSlice } from '../verify-success-screen/verifySuccessSlice';
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

describe('resendAsync', () => {
  it('RESEND_COOLDOWN restarts the countdown from retryAfter', async () => {
    const store = makeStore();
    network.resendVerification.mockRejectedValue(new ApiError('Wait', 'RESEND_COOLDOWN', 429, { retryAfter: 42 }));
    const before = Date.now();
    await store.dispatch(resendAsync());
    const at = store.getState().emailVerification.resendAvailableAt;
    expect(at - before).toBeGreaterThanOrEqual(41_000);
    expect(at - before).toBeLessThanOrEqual(43_000);
  });

  it('already verified: re-reads the account instead of waiting', async () => {
    const store = makeStore();
    network.resendVerification.mockResolvedValue({ retryAfter: 0, alreadyVerified: true });
    network.me.mockResolvedValue(verified);
    await store.dispatch(resendAsync());
    expect(store.getState().auth.user?.isEmailVerified).toBe(true);
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
    expect(r.payload).toBe(true);
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
    expect(store.getState().verifySuccess).toMatchObject({ status: 'failed', error: { code: 'VERIFY_LINK_INVALID' } });
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
