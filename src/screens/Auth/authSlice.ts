// ═══════════════════════════════════════════════════════
// MetroMatrix — Global Auth Slice (createAppSlice pattern)
// ═══════════════════════════════════════════════════════
// Holds global auth state only: the session user, their business (partners),
// the admin TOTP challenge between sign-in steps, and the onboarding flag.
// Per-screen form state and thunks live in their own co-located slices.
//
// Persistence: only `hasSeenOnboarding` is written to disk (nested
// persistReducer in store.ts). The session is rebuilt from the secure-store
// token by appContainer's bootstrapSession on every cold start.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { resetAllState } from '@store/resetAllState';
import type { Business, User } from '../../types/auth';

export interface PendingTotp {
  challengeToken: string;
  /** False on an admin's first sign-in: the TOTP step becomes enrolment. */
  enrolled: boolean;
  email: string;
}

export interface AuthSliceState {
  user: User | null;
  business: Business | null;
  isAuthenticated: boolean;
  hasSeenOnboarding: boolean;
  pendingTotp: PendingTotp | null;
}

const initialState: AuthSliceState = {
  user: null,
  business: null,
  isAuthenticated: false,
  hasSeenOnboarding: false,
  pendingTotp: null,
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
    /** A session was opened or refreshed (/auth/me). */
    setSession: create.reducer(
      (state, action: PayloadAction<{ user: User; business: Business | null }>) => {
        state.user = action.payload.user;
        state.business = action.payload.business;
        state.isAuthenticated = true;
        state.pendingTotp = null;
        // Anyone who has signed in has, by definition, seen the app's pitch.
        state.hasSeenOnboarding = true;
      },
    ),
    setUser: create.reducer((state, action: PayloadAction<User>) => {
      state.user = action.payload;
    }),
    setBusiness: create.reducer((state, action: PayloadAction<Business | null>) => {
      state.business = action.payload;
    }),
    setPendingTotp: create.reducer((state, action: PayloadAction<PendingTotp | null>) => {
      state.pendingTotp = action.payload;
    }),
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
    selectUser: state => state.user,
    selectBusiness: state => state.business,
    selectIsAuthenticated: state => state.isAuthenticated,
    selectHasSeenOnboarding: state => state.hasSeenOnboarding,
    selectPendingTotp: state => state.pendingTotp,
    selectRole: state => state.user?.role ?? null,
    selectIsEmailVerified: state => state.user?.isEmailVerified ?? false,
    selectBusinessStatus: state => state.business?.status ?? null,
    selectServiceType: state => state.business?.serviceType ?? null,
  },
});

export const { setSession, setUser, setBusiness, setPendingTotp, signOut, setOnboardingSeen } =
  authSlice.actions;

export const {
  selectUser,
  selectBusiness,
  selectIsAuthenticated,
  selectHasSeenOnboarding,
  selectPendingTotp,
  selectRole,
  selectIsEmailVerified,
  selectBusinessStatus,
  selectServiceType,
} = authSlice.selectors;

export default authSlice.reducer;
