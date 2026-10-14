// ═══════════════════════════════════════════════════════
// MetroMatrix — Navigation param lists
// ═══════════════════════════════════════════════════════
// One entry per route name in navigations-maps/Base.ts. Params are optional
// unless a screen genuinely cannot render without them: under React
// Navigation v7 a navigate() to a non-focused route PUSHES a fresh route, so
// its params are exactly what that caller passed.

import type { NavigatorScreenParams } from '@react-navigation/native';
import type { DocumentKind, Portal, ServiceType, SubType } from './auth';

/** BaseNavigator: onboarding, sign-in and every session gate. */
export type RootStackParamList = {
  Onboarding: undefined;
  Welcome: undefined;
  CustomerSignIn: { email?: string } | undefined;
  CustomerSignUp: undefined;
  PartnerSignIn: { email?: string } | undefined;
  PartnerSignUp: undefined;
  /** Deep link metromatrix://reset-password?email=…&code=… */
  ForgotPassword: { email?: string; code?: string; portal?: Exclude<Portal, 'admin'> } | undefined;
  AdminSignIn: { email?: string } | undefined;
  AdminTotp: undefined;
  TotpEnrol: undefined;
  /** Deep link metromatrix://verify-email?code=… */
  EmailVerification: { code?: string } | undefined;
  ServiceSelect: undefined;
  BusinessProfile: { serviceType?: ServiceType; subType?: SubType } | undefined;
  /** `highlight`: kinds the server reported missing on submit. */
  Documents: { highlight?: DocumentKind[] } | undefined;
  ReviewSubmit: undefined;
  PendingApproval: undefined;
  Rejected: undefined;
  Suspended: undefined;
  DesignGallery: undefined;
};

/** Profile tab stack — shared by every role app. */
export type AccountStackParamList = {
  Profile: undefined;
  ChangePassword: undefined;
};

export type CustomerTabParamList = {
  HomeTab: undefined;
  OrdersTab: undefined;
  ProfileTab: NavigatorScreenParams<AccountStackParamList> | undefined;
};

export type PartnerTabParamList = {
  HomeTab: undefined;
  ProfileTab: NavigatorScreenParams<AccountStackParamList> | undefined;
};

export type AdminStackParamList = {
  ApprovalQueue: undefined;
  BusinessReview: { id: string; name?: string };
};

export type AdminTabParamList = {
  ApprovalsTab: NavigatorScreenParams<AdminStackParamList> | undefined;
  ProfileTab: NavigatorScreenParams<AccountStackParamList> | undefined;
};
