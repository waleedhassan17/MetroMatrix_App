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

import OnboardingScreen from '../screens/Onboarding/OnboardingScreen';
import RoleSelectionScreen from '../screens/RoleSelection/RoleSelectionScreen';
import ProviderSelectionScreen from '../screens/ProviderSelection/ProviderSelectionScreen';
import SignInScreen from '../screens/Auth/SignIn/SignInScreen';
import SignUpScreen from '../screens/Auth/SignUp/SignUpScreen';
import ProviderSignInScreen from '../screens/Auth/ProviderSignIn/ProviderSignInScreen';
import ProviderSignUpScreen from '../screens/Auth/ProviderSignUp/ProviderSignUpScreen';
import ForgotPasswordScreen from '../screens/Auth/ForgotPassword/ForgotPasswordScreen';
import ResetPasswordOTPScreen from '../screens/Auth/ResetPasswordOTP/ResetPasswordOTPScreen';
import ResetPasswordScreen from '../screens/Auth/ResetPassword/ResetPasswordScreen';
import EmailVerificationScreen from '../screens/Auth/EmailVerification/EmailVerificationScreen';
import VerifySuccessScreen from '../screens/Auth/VerifySuccess/VerifySuccessScreen';
import CompleteProfileScreen from '../screens/Auth/CompleteProfile/CompleteProfileScreen';
import PersonalInfoScreen from '../screens/Partner/PersonalInfo/PersonalInfoScreen';
import ProviderApprovalPendingScreen from '../screens/Partner/ProviderApprovalPending/ProviderApprovalPendingScreen';
import RejectedScreen from '../screens/Partner/Rejected/RejectedScreen';
import SuspendedScreen from '../screens/Partner/Suspended/SuspendedScreen';
import AdminTotpScreen from '../screens/Admin/AdminTotp/AdminTotpScreen';
import AdminTwoFactorEnrolScreen from '../screens/Admin/AdminTwoFactorEnrol/AdminTwoFactorEnrolScreen';
import DesignGalleryScreen from '../screens/Dev/DesignGallery/DesignGalleryScreen';

/** Shown once per install, before Role Selection. */
export const ONBOARDING_ROUTE: IRoute = {
  title: ROUTES.ONBOARDING,
  component: OnboardingScreen,
  options: { animation: 'none' },
};

/** Dev builds only: the design-system gallery (/dev/gallery on web). */
const DEV_ROUTES: IRoute[] = __DEV__ ? [{ title: ROUTES.DESIGN_GALLERY, component: DesignGalleryScreen }] : [];

/** ── 1. Not authenticated ── */
export const UNAUTHENTICATED_ROUTES: IRoute[] = [
  { title: ROUTES.ROLE_SELECTION, component: RoleSelectionScreen, options: { animation: 'fade' } },
  { title: ROUTES.PROVIDER_SELECTION, component: ProviderSelectionScreen },
  { title: ROUTES.SIGN_IN, component: SignInScreen },
  { title: ROUTES.SIGN_UP, component: SignUpScreen, options: { animation: 'fade' } },
  { title: ROUTES.PROVIDER_SIGN_IN, component: ProviderSignInScreen },
  { title: ROUTES.PROVIDER_SIGN_UP, component: ProviderSignUpScreen, options: { animation: 'fade' } },
  { title: ROUTES.FORGOT_PASSWORD, component: ForgotPasswordScreen },
  { title: ROUTES.RESET_PASSWORD_OTP, component: ResetPasswordOTPScreen },
  { title: ROUTES.RESET_PASSWORD, component: ResetPasswordScreen },
  // The email link can open the app signed out (another device, a reinstall).
  { title: ROUTES.VERIFY_SUCCESS, component: VerifySuccessScreen },
  ...DEV_ROUTES,
];

/** ── 2. Staff TOTP challenge (no tokens yet) ── */
export const ADMIN_TOTP_ROUTES: IRoute[] = [
  { title: ROUTES.ADMIN_TOTP, component: AdminTotpScreen, options: { animation: 'none' } },
  { title: ROUTES.ADMIN_TWO_FACTOR_ENROL, component: AdminTwoFactorEnrolScreen, options: { animation: 'none' } },
];

/** ── 3. Email not verified ── */
export const EMAIL_VERIFY_ROUTES: IRoute[] = [
  { title: ROUTES.EMAIL_VERIFICATION, component: EmailVerificationScreen, options: { animation: 'none' } },
  { title: ROUTES.VERIFY_SUCCESS, component: VerifySuccessScreen },
];

/** ── 4. User, profile incomplete ── */
export const COMPLETE_PROFILE_ROUTES: IRoute[] = [
  { title: ROUTES.COMPLETE_PROFILE, component: CompleteProfileScreen, options: { animation: 'none' } },
];

/** ── 5. Provider with no application, or a draft ── */
export const PARTNER_SETUP_ROUTES: IRoute[] = [
  { title: ROUTES.PERSONAL_INFO, component: PersonalInfoScreen, options: { animation: 'none' } },
];

/** ── 6. Submitted, awaiting approval ── */
export const PENDING_ROUTES: IRoute[] = [
  { title: ROUTES.PROVIDER_APPROVAL_PENDING, component: ProviderApprovalPendingScreen, options: { animation: 'none' } },
];

/** ── 7. Rejected: the reason first, then Personal Info to resubmit ── */
export const REJECTED_ROUTES: IRoute[] = [
  { title: ROUTES.REJECTED, component: RejectedScreen, options: { animation: 'none' } },
  { title: ROUTES.PERSONAL_INFO, component: PersonalInfoScreen },
];

/** ── 8. Suspended ── */
export const SUSPENDED_ROUTES: IRoute[] = [
  { title: ROUTES.SUSPENDED, component: SuspendedScreen, options: { animation: 'none' } },
];
