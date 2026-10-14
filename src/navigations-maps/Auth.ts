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
import PartnerSignInScreen from '../screens/Auth/PartnerSignIn/PartnerSignInScreen';
import PartnerSignUpScreen from '../screens/Auth/PartnerSignUp/PartnerSignUpScreen';
import ServiceSelectScreen from '../screens/Partner/ServiceSelect/ServiceSelectScreen';
import BusinessProfileScreen from '../screens/Partner/BusinessProfile/BusinessProfileScreen';
import DocumentsScreen from '../screens/Partner/Documents/DocumentsScreen';
import ReviewSubmitScreen from '../screens/Partner/ReviewSubmit/ReviewSubmitScreen';
import PendingApprovalScreen from '../screens/Partner/PendingApproval/PendingApprovalScreen';
import RejectedScreen from '../screens/Partner/Rejected/RejectedScreen';
import SuspendedScreen from '../screens/Partner/Suspended/SuspendedScreen';
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
  { title: ROUTES.PARTNER_SIGN_IN, component: PartnerSignInScreen },
  { title: ROUTES.PARTNER_SIGN_UP, component: PartnerSignUpScreen },
  { title: ROUTES.FORGOT_PASSWORD, component: ForgotPasswordScreen },
  ...DEV_ROUTES,
];

/** ── 3. Email not verified ── */
export const EMAIL_VERIFY_ROUTES: IRoute[] = [
  { title: ROUTES.EMAIL_VERIFICATION, component: EmailVerificationScreen, options: { animation: 'none' } },
];

/**
 * ── 4. Partner with no business, or a draft ──
 * All four are registered so the partner can move back and forth; the
 * branch's initial route resumes where they left off (sessionGate's
 * partnerSetupInitialRoute).
 */
export const PARTNER_SETUP_ROUTES: IRoute[] = [
  { title: ROUTES.SERVICE_SELECT, component: ServiceSelectScreen },
  { title: ROUTES.BUSINESS_PROFILE, component: BusinessProfileScreen },
  { title: ROUTES.DOCUMENTS, component: DocumentsScreen },
  { title: ROUTES.REVIEW_SUBMIT, component: ReviewSubmitScreen },
];

/** ── 5. Submitted, awaiting approval ── */
export const PENDING_ROUTES: IRoute[] = [
  { title: ROUTES.PENDING_APPROVAL, component: PendingApprovalScreen, options: { animation: 'none' } },
];

/** ── 6. Rejected: the reason first, then the setup routes to resubmit ── */
export const REJECTED_ROUTES: IRoute[] = [
  { title: ROUTES.REJECTED, component: RejectedScreen, options: { animation: 'none' } },
  ...PARTNER_SETUP_ROUTES.filter(r => r.title !== ROUTES.SERVICE_SELECT),
];

/** ── 7. Suspended ── */
export const SUSPENDED_ROUTES: IRoute[] = [
  { title: ROUTES.SUSPENDED, component: SuspendedScreen, options: { animation: 'none' } },
];
