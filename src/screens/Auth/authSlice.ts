// ═══════════════════════════════════════════════════════
// MetroMatrix — Global Auth Slice (createAppSlice pattern)
// ═══════════════════════════════════════════════════════
// Holds global auth state only (session, onboarding flag). Per-screen
// state/thunks live in their own co-located slices.
//
// P0 skeleton: user / business / pendingTotp and setSession / setBusiness
// arrive with the auth domain layer (P2), typed from docs/API_AUTH.md.
//
// Persistence: only `hasSeenOnboarding` is written to disk (nested
// persistReducer in store.ts). The session itself is rebuilt from the
// secure-store token by appContainer's bootstrapSession on every cold start.

import { createAppSlice } from '@store/createAppSlice';
import { resetAllState } from '@store/resetAllState';

export interface AuthSliceState {
  isAuthenticated: boolean;
  hasSeenOnboarding: boolean;
}

const initialState: AuthSliceState = {
  isAuthenticated: false,
  hasSeenOnboarding: false,
};

/** Back to a signed-out session, keeping what belongs to the install. */
const toSignedOut = (state: AuthSliceState): AuthSliceState => ({
  ...initialState,
  hasSeenOnboarding: state.hasSeenOnboarding,
});

export const authSlice = createAppSlice({
  name: 'auth',
  initialState,
  reducers: create => ({
    signOut: create.reducer(state => toSignedOut(state)),
    setOnboardingSeen: create.reducer(state => {
      state.hasSeenOnboarding = true;
    }),
  }),

  // RESET_ALL_STATE reaches this slice like any other, but a returning user
  // must not see onboarding again — so auth resets itself rather than being
  // dropped wholesale at the root.
  extraReducers: builder => {
    builder.addCase(resetAllState, state => toSignedOut(state));
  },

  selectors: {
    selectIsAuthenticated: state => state.isAuthenticated,
    selectHasSeenOnboarding: state => state.hasSeenOnboarding,
  },
});

export const { signOut, setOnboardingSeen } = authSlice.actions;

export const { selectIsAuthenticated, selectHasSeenOnboarding } = authSlice.selectors;

export default authSlice.reducer;
