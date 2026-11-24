// ═══════════════════════════════════════════════════════
// MetroMatrix — Global Auth Slice (createAppSlice pattern)
// ═══════════════════════════════════════════════════════
// Holds global auth state only: the session user, their business (partners)
// and the admin TOTP challenge between sign-in steps. Per-screen form state
// and thunks live in their own co-located slices.
//
// Persistence: none. The session is rebuilt from the secure-store token by
// appContainer's bootstrapSession on every cold start, and RESET_ALL_STATE
// wipes this slice at the root like any account-scoped one.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from './createAppSlice';
import type { Business, User } from '../models/auth';

export interface PendingTotp {
  challengeToken: string;
  /** False on an admin's first sign-in: the TOTP step becomes enrolment. */
  enrolled: boolean;
  email: string;
}

/**
 * Where the signed-out navigator opens after a sign-out that asked for one: "Use a different account", and a
 * session that ended (the FYP's rule) — a provider on the provider sign-in, a rider on theirs, everyone else on
 * the User one.
 */
export type SignedOutLanding = 'SignIn' | 'ProviderSignIn' | 'RiderSignIn';

export interface AuthSliceState {
  user: User | null;
  business: Business | null;
  isAuthenticated: boolean;
  pendingTotp: PendingTotp | null;
  /** "Use a different account" and an ended session land on a sign-in; any other sign-out on Onboarding. */
  signedOutLanding: SignedOutLanding | null;
  /** The email that landing opens with (an ended session's account). */
  signedOutEmail: string | null;
}

const initialState: AuthSliceState = {
  user: null,
  business: null,
  isAuthenticated: false,
  pendingTotp: null,
  signedOutLanding: null,
  signedOutEmail: null,
};

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
        state.signedOutEmail = null;
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
    signOut: create.reducer((_state, action: PayloadAction<{ landing?: SignedOutLanding; email?: string } | undefined>) => ({
      ...initialState,
      signedOutLanding: action.payload?.landing ?? null,
      signedOutEmail: action.payload?.landing ? action.payload.email ?? null : null,
    })),
  }),

  selectors: {
    selectUser: state => state.user,
    selectBusiness: state => state.business,
    selectIsAuthenticated: state => state.isAuthenticated,
    selectPendingTotp: state => state.pendingTotp,
    selectRole: state => state.user?.role ?? null,
    selectIsEmailVerified: state => state.user?.isEmailVerified ?? false,
    selectBusinessStatus: state => state.business?.status ?? null,
    selectServiceType: state => state.business?.serviceType ?? null,
  },
});

export const { setSession, setUser, setBusiness, setPendingTotp, endPendingTotp, signOut } = authSlice.actions;

export const {
  selectUser,
  selectBusiness,
  selectIsAuthenticated,
  selectPendingTotp,
  selectRole,
  selectIsEmailVerified,
  selectBusinessStatus,
  selectServiceType,
} = authSlice.selectors;

export default authSlice.reducer;
