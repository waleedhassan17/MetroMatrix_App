// Each gate mounts its own whole stack (BaseNavigator, keyed `base-${gate}` in
// AppContainer), so Back can only move inside it. These tests pin what each
// stack holds, and that no gate can reach a screen that belongs to another.

import { ROUTES } from '../Base';
import { gateRoutes } from '../Auth';
import { gateInputOf, resolveGate, type Gate } from '../../navigators/sessionGate';
import { authSlice, setSession, signOut } from '../../screens/Auth/authSlice';
import { resetAllState } from '../../store/resetAllState';
import { makeUser } from '../../__fixtures__/users';
import type { Business } from '../../types/auth';

// Only the route names matter here; the screens themselves (and the native
// modules they pull in) are stubbed.
jest.mock('../../screens/Onboarding/OnboardingScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/RoleSelection/RoleSelectionScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/ProviderSelection/ProviderSelectionScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/Auth/SignIn/SignInScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/Auth/SignUp/SignUpScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/Auth/ProviderSignIn/ProviderSignInScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/Auth/ProviderSignUp/ProviderSignUpScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/Auth/ForgotPassword/ForgotPasswordScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/Auth/ResetPasswordOTP/ResetPasswordOTPScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/Auth/ResetPassword/ResetPasswordScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/Auth/EmailVerification/EmailVerificationScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/Auth/VerifySuccess/VerifySuccessScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/Auth/CompleteProfile/CompleteProfileScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/Partner/PersonalInfo/PersonalInfoScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/Partner/ProviderApprovalPending/ProviderApprovalPendingScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/Partner/Rejected/RejectedScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/Partner/Suspended/SuspendedScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/Admin/AdminTotp/AdminTotpScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/Admin/AdminTwoFactorEnrol/AdminTwoFactorEnrolScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/Dev/DesignGallery/DesignGalleryScreen', () => ({ __esModule: true, default: () => null }));

const titles = (gate: Gate, hasSeenOnboarding = true) => gateRoutes(gate, hasSeenOnboarding).map(r => r.title);

const SIGNED_OUT = [
  ROUTES.ROLE_SELECTION,
  ROUTES.PROVIDER_SELECTION,
  ROUTES.SIGN_IN,
  ROUTES.SIGN_UP,
  ROUTES.PROVIDER_SIGN_IN,
  ROUTES.PROVIDER_SIGN_UP,
  ROUTES.FORGOT_PASSWORD,
  ROUTES.RESET_PASSWORD_OTP,
  ROUTES.RESET_PASSWORD,
  ROUTES.VERIFY_SUCCESS,
  // Dev builds only (jest runs as one): the design-system gallery.
  ...(__DEV__ ? [ROUTES.DESIGN_GALLERY] : []),
];

// The branches BaseNavigator shows, in ladder order.
const GATED: Record<Exclude<Gate, 'unauthenticated' | 'customer' | 'partner' | 'admin'>, string[]> = {
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
    for (const gate of ['customer', 'partner', 'admin'] as Gate[]) expect(titles(gate)).toEqual(SIGNED_OUT);
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
