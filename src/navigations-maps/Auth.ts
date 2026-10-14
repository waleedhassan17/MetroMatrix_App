// ═══════════════════════════════════════════════════════
// MetroMatrix — Auth / onboarding / gate navigation map
// ═══════════════════════════════════════════════════════
// Route lists for BaseNavigator's session-gate branches. Which BRANCH renders
// is decided by navigators/sessionGate.ts (resolveGate); which NAVIGATOR
// mounts at the top level is decided by AppContainer.renderNavigator().
// Route names come from ./Base.ts and must never change.

import type { IRoute } from './types';
import { ROUTES } from './Base';

import OnboardingScreen from '../screens/Onboarding/OnboardingScreen';
import WelcomeScreen from '../screens/Auth/Welcome/WelcomeScreen';
import CustomerSignInScreen from '../screens/Auth/CustomerSignIn/CustomerSignInScreen';
import CustomerSignUpScreen from '../screens/Auth/CustomerSignUp/CustomerSignUpScreen';
import ForgotPasswordScreen from '../screens/Auth/ForgotPassword/ForgotPasswordScreen';
import EmailVerificationScreen from '../screens/Auth/EmailVerification/EmailVerificationScreen';
import DesignGalleryScreen from '../screens/Dev/DesignGallery/DesignGalleryScreen';

/** Shown once per install, before Welcome. */
export const ONBOARDING_ROUTE: IRoute = {
  title: ROUTES.ONBOARDING,
  component: OnboardingScreen,
  options: { animation: 'none' },
};

/** Dev builds only: the design-system gallery, reachable from Welcome. */
const DEV_ROUTES: IRoute[] = __DEV__
  ? [{ title: ROUTES.DESIGN_GALLERY, component: DesignGalleryScreen }]
  : [];

/** ── 1. Not authenticated ── */
export const UNAUTHENTICATED_ROUTES: IRoute[] = [
  { title: ROUTES.WELCOME, component: WelcomeScreen, options: { animation: 'none' } },
  { title: ROUTES.CUSTOMER_SIGN_IN, component: CustomerSignInScreen },
  { title: ROUTES.CUSTOMER_SIGN_UP, component: CustomerSignUpScreen },
  { title: ROUTES.FORGOT_PASSWORD, component: ForgotPasswordScreen },
  ...DEV_ROUTES,
];

/** ── 3. Email not verified ── */
export const EMAIL_VERIFY_ROUTES: IRoute[] = [
  { title: ROUTES.EMAIL_VERIFICATION, component: EmailVerificationScreen, options: { animation: 'none' } },
];
