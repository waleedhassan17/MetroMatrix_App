// ═══════════════════════════════════════════════════════
// MetroMatrix — Route names
// ═══════════════════════════════════════════════════════
// The single source of route-name strings. A name must NEVER change once
// shipped: deep links (metromatrix://) and navigate() strings depend on it.
// Add new names; never rename or reuse old ones.

export const ROUTES = {
  // ── Unauthenticated (BaseNavigator) ──
  ONBOARDING: 'Onboarding',
  WELCOME: 'Welcome',
  CUSTOMER_SIGN_IN: 'CustomerSignIn',
  CUSTOMER_SIGN_UP: 'CustomerSignUp',
  PARTNER_SIGN_IN: 'PartnerSignIn',
  PARTNER_SIGN_UP: 'PartnerSignUp',
  FORGOT_PASSWORD: 'ForgotPassword',
  ADMIN_SIGN_IN: 'AdminSignIn',

  // ── Session gates (BaseNavigator) ──
  ADMIN_TOTP: 'AdminTotp',
  TOTP_ENROL: 'TotpEnrol',
  EMAIL_VERIFICATION: 'EmailVerification',
  SERVICE_SELECT: 'ServiceSelect',
  BUSINESS_PROFILE: 'BusinessProfile',
  DOCUMENTS: 'Documents',
  REVIEW_SUBMIT: 'ReviewSubmit',
  PENDING_APPROVAL: 'PendingApproval',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',

  // ── Tabs (role navigators) ──
  HOME_TAB: 'HomeTab',
  ORDERS_TAB: 'OrdersTab',
  PROFILE_TAB: 'ProfileTab',
  APPROVALS_TAB: 'ApprovalsTab',

  // ── Screens inside tabs ──
  CUSTOMER_HOME: 'CustomerHome',
  ORDERS: 'Orders',
  PARTNER_HOME: 'PartnerHome',
  PROFILE: 'Profile',
  CHANGE_PASSWORD: 'ChangePassword',
  APPROVAL_QUEUE: 'ApprovalQueue',
  BUSINESS_REVIEW: 'BusinessReview',

  // ── Dev only ──
  DESIGN_GALLERY: 'DesignGallery',
} as const;

export type RouteName = typeof ROUTES[keyof typeof ROUTES];
