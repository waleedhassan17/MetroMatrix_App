// Each gate mounts its own whole stack (BaseNavigator, keyed `base-${gate}` in
// AppContainer), so Back can only move inside it. These tests pin what each
// stack holds, and that no gate can reach a screen that belongs to another.

// What each stack holds is pinned here, not the screens (they load native
// modules Jest has no implementation for), so every screen is a stub.
jest.mock('../../screens/onboarding-screen/Onboarding', () => () => null);
jest.mock('../../screens/role-selection-screen/RoleSelection', () => () => null);
jest.mock('../../screens/provider-selection-screen/ProviderSelection', () => () => null);
jest.mock('../../screens/sign-in-screen/SignIn', () => () => null);
jest.mock('../../screens/sign-up-screen/SignUp', () => () => null);
jest.mock('../../screens/provider-sign-in-screen/ProviderSignIn', () => () => null);
jest.mock('../../screens/provider-sign-up-screen/ProviderSignUp', () => () => null);
jest.mock('../../screens/forgot-password-screen/ForgotPassword', () => () => null);
jest.mock('../../screens/reset-password-otp-screen/ResetPasswordOTP', () => () => null);
jest.mock('../../screens/reset-password-screen/ResetPassword', () => () => null);
jest.mock('../../screens/email-verification-screen/EmailVerification', () => () => null);
jest.mock('../../screens/verify-success-screen/VerifySuccess', () => () => null);
jest.mock('../../screens/complete-profile-screen/CompleteProfile', () => () => null);
jest.mock('../../screens/personal-info-screen/PersonalInfo', () => () => null);
jest.mock('../../screens/provider-approval-pending-screen/ProviderApprovalPending', () => () => null);
jest.mock('../../screens/rejected-screen/Rejected', () => () => null);
jest.mock('../../screens/suspended-screen/Suspended', () => () => null);
jest.mock('../../screens/admin-totp-screen/AdminTotp', () => () => null);
jest.mock('../../screens/admin-two-factor-enrol-screen/AdminTwoFactorEnrol', () => () => null);
jest.mock('../../screens/design-gallery-screen/DesignGallery', () => () => null);
jest.mock('../../screens/rider-sign-in-screen/RiderSignIn', () => () => null);
jest.mock('../../screens/public-store-screen/PublicStore', () => () => null);

import { ROUTES } from '../Base';
import { gateRoutes } from '../Auth';
import { gateInputOf, resolveGate, type Gate } from '../../navigators/sessionGate';
import { authSlice, setSession, signOut } from '../../store/authSlice';
import { resetAllState } from '../../store/resetAllState';
import { makeUser } from '../../__fixtures__/users';
import type { Business } from '../../models/auth';

// Only the route names matter here; the screens themselves (and the native
// modules they pull in) are stubbed.
jest.mock('../../screens/onboarding-screen/Onboarding', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/role-selection-screen/RoleSelection', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/provider-selection-screen/ProviderSelection', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/sign-in-screen/SignIn', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/sign-up-screen/SignUp', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/provider-sign-in-screen/ProviderSignIn', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/provider-sign-up-screen/ProviderSignUp', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/forgot-password-screen/ForgotPassword', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/reset-password-otp-screen/ResetPasswordOTP', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/reset-password-screen/ResetPassword', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/email-verification-screen/EmailVerification', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/verify-success-screen/VerifySuccess', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/complete-profile-screen/CompleteProfile', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/personal-info-screen/PersonalInfo', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/provider-approval-pending-screen/ProviderApprovalPending', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/rejected-screen/Rejected', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/suspended-screen/Suspended', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/admin-totp-screen/AdminTotp', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/admin-two-factor-enrol-screen/AdminTwoFactorEnrol', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/design-gallery-screen/DesignGallery', () => ({ __esModule: true, default: () => null }));

const titles = (gate: Gate, hasSeenOnboarding = true) => gateRoutes(gate, hasSeenOnboarding).map(r => r.title);

const SIGNED_OUT = [
  ROUTES.ROLE_SELECTION,
  ROUTES.PROVIDER_SELECTION,
  ROUTES.SIGN_IN,
  ROUTES.SIGN_UP,
  ROUTES.PROVIDER_SIGN_IN,
  ROUTES.RIDER_SIGN_IN,
  ROUTES.PROVIDER_SIGN_UP,
  ROUTES.FORGOT_PASSWORD,
  ROUTES.RESET_PASSWORD_OTP,
  ROUTES.RESET_PASSWORD,
  ROUTES.VERIFY_SUCCESS,
  // A kitchen's own link or QR, opened signed out.
  ROUTES.PUBLIC_STORE,
  // Dev builds only (jest runs as one): the design-system gallery.
  ...(__DEV__ ? [ROUTES.DESIGN_GALLERY] : []),
];

// The branches BaseNavigator shows, in ladder order.
const GATED: Record<Exclude<Gate, 'unauthenticated' | 'customer' | 'partner' | 'rider' | 'admin'>, string[]> = {
  totp: [ROUTES.ADMIN_TOTP, ROUTES.ADMIN_TWO_FACTOR_ENROL],
  verify: [ROUTES.EMAIL_VERIFICATION, ROUTES.VERIFY_SUCCESS],
  completeProfile: [ROUTES.COMPLETE_PROFILE],
  partnerSetup: [ROUTES.PERSONAL_INFO, ROUTES.PROVIDER_SELECTION],
  pending: [ROUTES.PROVIDER_APPROVAL_PENDING],
  rejected: [ROUTES.REJECTED, ROUTES.PERSONAL_INFO],
  suspended: [ROUTES.SUSPENDED],
};

// Screens shared on purpose, and why:
const SHARED: Record<string, string> = {
  // The email link may open the app signed out (another device) or signed in.
  [ROUTES.VERIFY_SUCCESS]: 'unauthenticated + verify',
  // Choosing a service before sign-up, or after sign-in on a new device.
  [ROUTES.PROVIDER_SELECTION]: 'unauthenticated + partnerSetup',
  // Fixing a rejected application reuses the setup form.
  [ROUTES.PERSONAL_INFO]: 'partnerSetup + rejected',
};

describe('gateRoutes: the stack each gate mounts', () => {
  it('signed out: Role Selection and the sign-in / sign-up / reset screens, with Onboarding only until seen', () => {
    expect(titles('unauthenticated')).toEqual(SIGNED_OUT);
    expect(titles('unauthenticated', false)).toEqual([ROUTES.ONBOARDING, ...SIGNED_OUT]);
  });

  it.each(Object.entries(GATED))('%s mounts exactly its own screens', (gate, expected) => {
    expect(titles(gate as Gate)).toEqual(expected);
    // Onboarding belongs to the signed-out stack only.
    expect(titles(gate as Gate, false)).toEqual(expected);
  });

  it('a role gate never renders BaseNavigator; if asked, it falls back to signed out', () => {
    for (const gate of ['customer', 'partner', 'rider', 'admin'] as Gate[]) expect(titles(gate)).toEqual(SIGNED_OUT);
  });
});

describe('gateRoutes: no gate can reach another gate’s screens', () => {
  const ALL: Record<string, string[]> = { unauthenticated: SIGNED_OUT, ...GATED };
  const owners = (screen: string) => Object.keys(ALL).filter(g => ALL[g].includes(screen));

  it('every screen belongs to one gate, except the three shared on purpose', () => {
    const shared = Object.values(ALL)
      .flat()
      .filter((s, i, all) => all.indexOf(s) === i && owners(s).length > 1);
    expect(shared.sort()).toEqual(Object.keys(SHARED).sort());
    for (const [screen, between] of Object.entries(SHARED)) expect(owners(screen).join(' + ')).toBe(between);
  });

  it('once signed in, no stack offers sign-in, sign-up or password reset (Back cannot leave the session)', () => {
    const doors = [ROUTES.SIGN_IN, ROUTES.SIGN_UP, ROUTES.PROVIDER_SIGN_IN, ROUTES.PROVIDER_SIGN_UP, ROUTES.ROLE_SELECTION, ROUTES.FORGOT_PASSWORD, ROUTES.RESET_PASSWORD_OTP, ROUTES.RESET_PASSWORD];
    for (const gate of Object.keys(GATED) as Gate[]) {
      for (const door of doors) expect(titles(gate)).not.toContain(door);
    }
  });

  it('signed out, no stack offers a gated screen', () => {
    const gatedOnly = Object.values(GATED)
      .flat()
      .filter(s => !SHARED[s]);
    for (const screen of gatedOnly) expect(titles('unauthenticated', false)).not.toContain(screen);
  });

  it('sign-out (resetAllState, then signOut) lands on Role Selection; "Use a different account" on Sign In', () => {
    const signedIn = authSlice.reducer(
      undefined,
      setSession({ user: makeUser({ role: 'partner' }), business: { status: 'approved', subType: 'store' } as Business }),
    );
    expect(resolveGate(gateInputOf(signedIn, {}))).toBe('partner');

    const out = authSlice.reducer(authSlice.reducer(signedIn, resetAllState()), signOut(undefined));
    const gate = resolveGate(gateInputOf(out, {}));
    expect(gate).toBe('unauthenticated');
    // Onboarding is not shown again, so the stack opens on Role Selection.
    expect(out.signedOutLanding).toBeNull();
    expect(titles(gate, out.hasSeenOnboarding)[0]).toBe(ROUTES.ROLE_SELECTION);

    const other = authSlice.reducer(authSlice.reducer(signedIn, resetAllState()), signOut({ landing: 'SignIn' }));
    expect(other.signedOutLanding).toBe(ROUTES.SIGN_IN);
    expect(titles(resolveGate(gateInputOf(other, {})), other.hasSeenOnboarding)).toContain(ROUTES.SIGN_IN);
  });

  it('a partner under review cannot step back into setup, and a suspended one into anything', () => {
    expect(titles('pending')).not.toContain(ROUTES.PERSONAL_INFO);
    expect(titles('suspended')).toEqual([ROUTES.SUSPENDED]);
    expect(titles('verify')).not.toContain(ROUTES.COMPLETE_PROFILE);
    expect(titles('completeProfile')).not.toContain(ROUTES.PERSONAL_INFO);
  });
});
