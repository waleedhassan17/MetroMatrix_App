// ═══════════════════════════════════════════════════════
// MetroMatrix — Route names
// ═══════════════════════════════════════════════════════
// The single source of route-name strings — the FYP app's names, so the two
// apps read the same. A name must NEVER change once shipped: deep links
// (metromatrix://) and navigate() strings depend on it.

export const ROUTES = {
  // ── Entry (BaseNavigator, signed out) ──
  ONBOARDING: 'Onboarding',
  ROLE_SELECTION: 'RoleSelection',
  PROVIDER_SELECTION: 'ProviderSelection',

  // ── User authentication ──
  SIGN_IN: 'SignIn',
  SIGN_UP: 'SignUp',
  FORGOT_PASSWORD: 'ForgotPassword',
  RESET_PASSWORD_OTP: 'ResetPasswordOTP',
  RESET_PASSWORD: 'ResetPassword',
  EMAIL_VERIFICATION: 'EmailVerification',
  VERIFY_SUCCESS: 'VerifySuccess',
  COMPLETE_PROFILE: 'CompleteProfile',

  // ── Provider authentication ──
  PROVIDER_SIGN_IN: 'ProviderSignIn',
  PROVIDER_SIGN_UP: 'ProviderSignUp',
  PERSONAL_INFO: 'PersonalInfo',
  PROVIDER_APPROVAL_PENDING: 'ProviderApprovalPending',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',

  // ── Staff (signs in from SignIn) ──
  ADMIN_TOTP: 'AdminTotp',
  ADMIN_TWO_FACTOR_ENROL: 'AdminTwoFactorEnrol',

  // ── Tabs (role navigators) ──
  HOME_TAB: 'HomeTab',
  ORDERS_TAB: 'OrdersTab',
  PROFILE_TAB: 'ProfileTab',
  APPROVALS_TAB: 'ApprovalsTab',

  // ── Screens inside tabs ──
  CUSTOMER_HOME: 'CustomerHome',
  FOOD_HOME: 'FoodHome',
  SERVICE_PREVIEW: 'ServicePreview',
  ORDERS: 'Orders',
  PARTNER_HOME: 'PartnerHome',
  PROFILE: 'Profile',
  CHANGE_PASSWORD: 'ChangePassword',
  APPROVAL_QUEUE: 'ApprovalQueue',
  BUSINESS_REVIEW: 'BusinessReview',

  // ── Dev only ──
  DESIGN_GALLERY: 'DesignGallery',
} as const;

export type RouteName = (typeof ROUTES)[keyof typeof ROUTES];
