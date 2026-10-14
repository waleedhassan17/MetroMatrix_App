// ═══════════════════════════════════════════════════════
// MetroMatrix — App Container Slice (createAppSlice pattern)
// ═══════════════════════════════════════════════════════
// Holds app-shell state: readiness and network status. Lives alongside
// AppContainer.tsx in components/app-container/. Survives RESET_ALL_STATE.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { getAccessToken } from '../../utils/storageUtils';
import { signOut } from '../../screens/Auth/authSlice';

export interface AppContainerSliceState {
  error: string;
  status: 'idle' | 'loading' | 'failed';
  isAppReady: boolean;
  networkIsDown: boolean;
}

const initialState: AppContainerSliceState = {
  error: '',
  status: 'idle',
  isAppReady: false,
  networkIsDown: false,
};

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
     *   token missing        → app ready, unauthenticated (Welcome)
     *   authMe OK            → setSession with the FRESH user + business
     *   authMe 401/rejected  → tokens cleared, signed out → Welcome
     *   network unreachable  → networkIsDown, keep the tokens; retry later
     *
     * P0: only the "token missing" branch exists. The authMe branches arrive
     * with the auth domain layer (P2).
     */
    bootstrapSession: create.asyncThunk(
      async (_: void, { dispatch }) => {
        const token = await getAccessToken();
        if (!token) {
          // No token ⇒ no session. Also reconciles a stale in-memory
          // isAuthenticated (tokens wiped outside a normal sign-out).
          dispatch(signOut());
          return { restored: false as const };
        }
        return { restored: false as const };
      },
      {
        pending: state => {
          state.status = 'loading';
        },
        fulfilled: state => {
          state.status = 'idle';
          state.isAppReady = true;
        },
        rejected: state => {
          state.status = 'idle';
          state.isAppReady = true;
        },
      },
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
    });
  },

  selectors: {
    selectAppStatus: state => state.status,
    selectAppError: state => state.error,
    selectIsAppReady: state => state.isAppReady,
    selectNetworkIsDown: state => state.networkIsDown,
  },
});

export const { setAppIsReady, setNetworkIsDown, setAppError, clearAppError, bootstrapSession } =
  appContainerSlice.actions;

export const { selectAppStatus, selectAppError, selectIsAppReady, selectNetworkIsDown } =
  appContainerSlice.selectors;
