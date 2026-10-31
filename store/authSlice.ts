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
import { createAppSlice } from './createAppSlice';
import { resetAllState } from './resetAllState';
import type { Business, User } from '../models/auth';

export interface PendingTotp {
  challengeToken: string;
  /** False on an admin's first sign-in: the TOTP step becomes enrolment. */
  enrolled: boolean;
  email: string;
}

/** Where the signed-out navigator opens after a sign-out that asked for one. */
export type SignedOutLanding = 'SignIn';

export interface AuthSliceState {
  user: User | null;
  business: Business | null;
  isAuthenticated: boolean;
  hasSeenOnboarding: boolean;
  pendingTotp: PendingTotp | null;
  /** "Use a different account" lands on Sign In; any other sign-out on Role Selection. */
  signedOutLanding: SignedOutLanding | null;
}

const initialState: AuthSliceState = {
  user: null,
  business: null,
  isAuthenticated: false,
  hasSeenOnboarding: false,
  pendingTotp: null,
  signedOutLanding: null,
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
        state.signedOutLanding = null;
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
    /** The staff sign-in challenge died (expired, spent, too many codes): back to Sign In. */
    endPendingTotp: create.reducer(state => {
      state.pendingTotp = null;
      state.signedOutLanding = 'SignIn';
    }),
    signOut: create.reducer((state, action: PayloadAction<{ landing?: SignedOutLanding } | undefined>) => ({
      ...toSignedOut(state),
      signedOutLanding: action.payload?.landing ?? null,
    })),
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

export const { setSession, setUser, setBusiness, setPendingTotp, endPendingTotp, signOut, setOnboardingSeen } =
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
