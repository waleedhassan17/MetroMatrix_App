// ═══════════════════════════════════════════════════════
// MetroMatrix — Auth / onboarding / gate navigation map
// ═══════════════════════════════════════════════════════
// Route lists for BaseNavigator's session-gate branches. Which BRANCH renders
// is decided by navigators/sessionGate.ts (resolveGate); which NAVIGATOR
// mounts at the top level is decided by AppContainer.renderNavigator().
// Route names come from ./Base.ts and must never change.
//
// The FYP app's flow:
//   Splash (overlay) → Onboarding (first launch) → Role Selection
//     User     → Sign In / Sign Up → Email Verification → Complete Profile
//     Provider → Provider Selection → Provider Sign In / Sign Up
//                → Email Verification → Personal Info → Approval Pending

import type { IRoute } from './types';
import { ROUTES } from './Base';
import type { Gate } from '../navigators/sessionGate';

import Onboarding from '../screens/onboarding-screen/Onboarding';
import RoleSelection from '../screens/role-selection-screen/RoleSelection';
import ProviderSelection from '../screens/provider-selection-screen/ProviderSelection';
import SignIn from '../screens/sign-in-screen/SignIn';
import SignUp from '../screens/sign-up-screen/SignUp';
import ProviderSignIn from '../screens/provider-sign-in-screen/ProviderSignIn';
import ProviderSignUp from '../screens/provider-sign-up-screen/ProviderSignUp';
import ForgotPassword from '../screens/forgot-password-screen/ForgotPassword';
import ResetPasswordOTP from '../screens/reset-password-otp-screen/ResetPasswordOTP';
import ResetPassword from '../screens/reset-password-screen/ResetPassword';
import EmailVerification from '../screens/email-verification-screen/EmailVerification';
import VerifySuccess from '../screens/verify-success-screen/VerifySuccess';
import CompleteProfile from '../screens/complete-profile-screen/CompleteProfile';
import PersonalInfo from '../screens/personal-info-screen/PersonalInfo';
import ProviderApprovalPending from '../screens/provider-approval-pending-screen/ProviderApprovalPending';
import Rejected from '../screens/rejected-screen/Rejected';
import Suspended from '../screens/suspended-screen/Suspended';
import AdminTotp from '../screens/admin-totp-screen/AdminTotp';
import AdminTwoFactorEnrol from '../screens/admin-two-factor-enrol-screen/AdminTwoFactorEnrol';
import DesignGallery from '../screens/design-gallery-screen/DesignGallery';
import RiderSignIn from '../screens/rider-sign-in-screen/RiderSignIn';
import PublicStore from '../screens/public-store-screen/PublicStore';

/** Shown once per install, before Role Selection. */
export const ONBOARDING_ROUTE: IRoute = {
  title: ROUTES.ONBOARDING,
  component: Onboarding,
  options: { animation: 'none' },
};

/** Dev builds only: the design-system gallery (/dev/gallery on web). */
const DEV_ROUTES: IRoute[] = __DEV__
  ? [{ title: ROUTES.DESIGN_GALLERY, component: DesignGallery }]
  : [];

/** ── 1. Not authenticated ── */
export const UNAUTHENTICATED_ROUTES: IRoute[] = [
  { title: ROUTES.ROLE_SELECTION, component: RoleSelection, options: { animation: 'fade' } },
  { title: ROUTES.PROVIDER_SELECTION, component: ProviderSelection },
  { title: ROUTES.SIGN_IN, component: SignIn },
  { title: ROUTES.SIGN_UP, component: SignUp, options: { animation: 'fade' } },
  { title: ROUTES.PROVIDER_SIGN_IN, component: ProviderSignIn },
  { title: ROUTES.RIDER_SIGN_IN, component: RiderSignIn },
  {
    title: ROUTES.PROVIDER_SIGN_UP,
    component: ProviderSignUp,
    options: { animation: 'fade' },
  },
  { title: ROUTES.FORGOT_PASSWORD, component: ForgotPassword },
  { title: ROUTES.RESET_PASSWORD_OTP, component: ResetPasswordOTP },
  { title: ROUTES.RESET_PASSWORD, component: ResetPassword },
  // The email link can open the app signed out (another device, a reinstall).
  { title: ROUTES.VERIFY_SUCCESS, component: VerifySuccess },
  // A kitchen's own link or QR, read before signing in (Food Court, 5B).
  { title: ROUTES.PUBLIC_STORE, component: PublicStore },
  ...DEV_ROUTES,
];

/** ── 2. Staff TOTP challenge (no tokens yet) ── */
export const ADMIN_TOTP_ROUTES: IRoute[] = [
  { title: ROUTES.ADMIN_TOTP, component: AdminTotp, options: { animation: 'none' } },
  {
    title: ROUTES.ADMIN_TWO_FACTOR_ENROL,
    component: AdminTwoFactorEnrol,
    options: { animation: 'none' },
  },
];

/** ── 3. Email not verified ── */
export const EMAIL_VERIFY_ROUTES: IRoute[] = [
  {
    title: ROUTES.EMAIL_VERIFICATION,
    component: EmailVerification,
    options: { animation: 'none' },
  },
  { title: ROUTES.VERIFY_SUCCESS, component: VerifySuccess },
];

/** ── 4. User, profile incomplete ── */
export const COMPLETE_PROFILE_ROUTES: IRoute[] = [
  {
    title: ROUTES.COMPLETE_PROFILE,
    component: CompleteProfile,
    options: { animation: 'none' },
  },
];

/**
 * ── 5. Provider with no application, or a draft ──
 * Provider Selection is here for a provider whose service isn't known yet
 * (sessionGate.partnerSetupInitialRoute); it then continues to Personal Info.
 */
export const PARTNER_SETUP_ROUTES: IRoute[] = [
  { title: ROUTES.PERSONAL_INFO, component: PersonalInfo, options: { animation: 'none' } },
  { title: ROUTES.PROVIDER_SELECTION, component: ProviderSelection, options: { animation: 'none' } },
];

/** ── 6. Submitted, awaiting approval ── */
export const PENDING_ROUTES: IRoute[] = [
  {
    title: ROUTES.PROVIDER_APPROVAL_PENDING,
    component: ProviderApprovalPending,
    options: { animation: 'none' },
  },
];

/** ── 7. Rejected: the reason first, then Personal Info to resubmit ── */
export const REJECTED_ROUTES: IRoute[] = [
  { title: ROUTES.REJECTED, component: Rejected, options: { animation: 'none' } },
  { title: ROUTES.PERSONAL_INFO, component: PersonalInfo },
];

/** ── 8. Suspended ── */
export const SUSPENDED_ROUTES: IRoute[] = [
  { title: ROUTES.SUSPENDED, component: Suspended, options: { animation: 'none' } },
];

const GATE_BRANCHES: Partial<Record<Gate, IRoute[]>> = {
  totp: ADMIN_TOTP_ROUTES,
  verify: EMAIL_VERIFY_ROUTES,
  completeProfile: COMPLETE_PROFILE_ROUTES,
  partnerSetup: PARTNER_SETUP_ROUTES,
  pending: PENDING_ROUTES,
  rejected: REJECTED_ROUTES,
  suspended: SUSPENDED_ROUTES,
};

/**
 * The routes BaseNavigator mounts for a gate: the whole stack, so Back can
 * only move within the branch. Any other gate (a role app's, which
 * BaseNavigator never shows) falls back to the signed-out branch.
 */
export const gateRoutes = (gate: Gate, hasSeenOnboarding: boolean): IRoute[] =>
  GATE_BRANCHES[gate] ?? [...(!hasSeenOnboarding ? [ONBOARDING_ROUTE] : []), ...UNAUTHENTICATED_ROUTES];
