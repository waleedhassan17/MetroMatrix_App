// ═══════════════════════════════════════════════════════
// MetroMatrix — App Container Slice (createAppSlice pattern)
// ═══════════════════════════════════════════════════════
// Holds app-shell state: readiness, network status, and the session
// bootstrap. Lives alongside AppContainer.tsx. Survives RESET_ALL_STATE.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { getAccessToken, getRefreshToken, clearTokens } from '../../utils/storageUtils';
import { authMe } from '../../networks/auth/authNetwork';
import { isNetworkError, refreshTokens, isDefinitiveSessionFailure } from '../../networks/network/apiHelpers';
import { setSession, signOut } from '../../screens/Auth/authSlice';
import { registerDevice } from '../../networks/users/usersNetwork';
import { setPushToken } from '../../utils/storageUtils';
import { obtainPushToken, pushPlatform } from '../../services/push';

export interface AppContainerSliceState {
  error: string;
  status: 'idle' | 'loading' | 'failed';
  isAppReady: boolean;
  /**
   * Cold start found a stored session but could not reach the API. The app
   * shows an offline state with Retry instead of bouncing a signed-in user
   * to Welcome.
   */
  networkIsDown: boolean;
  /** Why: no connection, or the API answering 5xx / 429. Shapes the gate's copy. */
  downReason: 'offline' | 'server';
}

const initialState: AppContainerSliceState = {
  error: '',
  status: 'idle',
  isAppReady: false,
  networkIsDown: false,
  downReason: 'offline',
};

type BootstrapOutcome = 'restored' | 'signedOut' | 'offline' | 'serverDown';

export const appContainerSlice = createAppSlice({
  name: 'appContainer',
  initialState,
  reducers: create => ({
    setAppIsReady: create.reducer((state, action: PayloadAction<boolean>) => {
      state.isAppReady = action.payload;
    }),
    setNetworkIsDown: create.reducer((state, action: PayloadAction<boolean>) => {
      state.networkIsDown = action.payload;
    }),
    setAppError: create.reducer((state, action: PayloadAction<string>) => {
      state.error = action.payload;
    }),
    clearAppError: create.reducer(state => {
      state.error = '';
    }),

    /**
     * Session restore on cold start: if an access token is in secure-store,
     * refresh the current user from GET /auth/me — the user goes straight to
     * their view without signing in again until the token is unrefreshable.
     * The axios client attaches the Bearer token and silently refreshes on
     * 401, so this call also rolls an expired access token.
     *
     *   no tokens at all     → app ready, unauthenticated (Welcome)
     *   refresh token only   → refresh first, then as below
     *   authMe OK            → setSession with the FRESH user + business
     *                          (role, verification, business status may all
     *                          have changed server-side)
     *   definitive failure   → tokens cleared, signed out → Welcome
     *                          (sessionRefresh.isDefinitiveSessionFailure)
     *   anything else        → networkIsDown (offline, or the API failing);
     *                          tokens KEPT; Retry re-runs this
     */
    bootstrapSession: create.asyncThunk(
      async (_: void, { dispatch }): Promise<BootstrapOutcome> => {
        const [access, refresh] = await Promise.all([getAccessToken(), getRefreshToken()]);
        if (!access && !refresh) {
          // No token ⇒ no session. Also reconciles stale in-memory state
          // (tokens wiped outside a normal sign-out).
          dispatch(signOut());
          return 'signedOut';
        }
        try {
          // The access token can be gone while the refresh token lives on
          // (cleared, or never stored): refresh instead of signing out.
          if (!access) await refreshTokens();
          const session = await authMe();
          dispatch(setSession(session));
          return 'restored';
        } catch (e) {
          if (isDefinitiveSessionFailure(e)) {
            await clearTokens();
            dispatch(signOut());
            return 'signedOut';
          }
          return isNetworkError(e) ? 'offline' : 'serverDown';
        }
      },
      {
        pending: state => {
          state.status = 'loading';
        },
        fulfilled: (state, action) => {
          state.status = 'idle';
          state.isAppReady = true;
          state.networkIsDown = action.payload === 'offline' || action.payload === 'serverDown';
          state.downReason = action.payload === 'serverDown' ? 'server' : 'offline';
        },
        rejected: state => {
          state.status = 'idle';
          state.isAppReady = true;
        },
      },
    ),

    /**
     * Mid-session re-read of /auth/me (business suspended, approval landed,
     * email verified). Unlike bootstrap it never signs anyone out: a 401 is
     * the interceptor's business, and a network blip leaves state as it was.
     */
    refreshSession: create.asyncThunk(
      async (_: void, { dispatch }) => {
        try {
          const session = await authMe();
          dispatch(setSession(session));
          return true;
        } catch {
          return false;
        }
      },
      {},
    ),

    /**
     * Register this device for push after a session opens. `ask` shows the OS
     * dialog (after the pre-prompt sheet); otherwise only an existing grant is
     * used, so each new session silently re-registers a rotated token.
     * Never fails the session: push is a nicety.
     */
    registerPushAsync: create.asyncThunk(
      async ({ ask }: { ask: boolean }) => {
        try {
          const token = await obtainPushToken(ask);
          if (!token) return null;
          await registerDevice(token, pushPlatform());
          await setPushToken(token);
          return token;
        } catch {
          return null;
        }
      },
      {},
    ),
  }),

  // Belt-and-braces for the stuck-splash class of bug: signing out must never
  // make the shell "not ready". store.ts already preserves this slice through
  // RESET_ALL_STATE; this guarantees the invariant even if that changes.
  extraReducers: builder => {
    builder.addCase(signOut, state => {
      state.isAppReady = true;
      state.status = 'idle';
      state.error = '';
      state.networkIsDown = false;
    });
  },

  selectors: {
    selectAppStatus: state => state.status,
    selectAppError: state => state.error,
    selectIsAppReady: state => state.isAppReady,
    selectNetworkIsDown: state => state.networkIsDown,
    selectDownReason: state => state.downReason,
  },
});

export const {
  setAppIsReady,
  setNetworkIsDown,
  setAppError,
  clearAppError,
  bootstrapSession,
  refreshSession,
  registerPushAsync,
} = appContainerSlice.actions;

export const { selectAppStatus, selectAppError, selectIsAppReady, selectNetworkIsDown, selectDownReason } =
  appContainerSlice.selectors;
