// ═══════════════════════════════════════════════════════
// MetroMatrix — Navigation param lists
// ═══════════════════════════════════════════════════════
// One entry per route name in navigations-maps/Base.ts. Params are optional
// unless a screen genuinely cannot render without them: under React
// Navigation v7 a navigate() to a non-focused route PUSHES a fresh route, so
// its params are exactly what that caller passed.

import type { NavigatorScreenParams } from '@react-navigation/native';
import type { DocumentKind } from './auth';

/** BaseNavigator: onboarding, sign-in and every session gate. */
export type RootStackParamList = {
  Onboarding: undefined;
  RoleSelection: undefined;
  ProviderSelection: undefined;
  SignIn: { email?: string } | undefined;
  SignUp: undefined;
  ProviderSignIn: { email?: string } | undefined;
  ProviderSignUp: undefined;
  ForgotPassword: { email?: string; userType?: AuthUserType } | undefined;
  /** Deep link metromatrix://reset-password?email=… */
  ResetPasswordOTP: { email: string; userType?: AuthUserType };
  /** The reset token stays in the OTP slice — never in a route param (a web URL). */
  ResetPassword: { email: string; userType?: AuthUserType };
  EmailVerification: undefined;
  /** Deep link metromatrix://verify-success?token=… */
  VerifySuccess: { token?: string } | undefined;
  CompleteProfile: undefined;
  /** `step` jumps to a step; `highlight` marks documents the server said are missing. */
  PersonalInfo: { step?: 1 | 2 | 3; highlight?: DocumentKind[] } | undefined;
  ProviderApprovalPending: undefined;
  Rejected: undefined;
  Suspended: undefined;
  AdminTotp: undefined;
  AdminTwoFactorEnrol: undefined;
  DesignGallery: undefined;
};

/** Which sign-in a password reset returns to (the FYP's `userType`). */
export type AuthUserType = 'user' | 'provider';

/** Profile tab stack — shared by every role app. */
export type AccountStackParamList = {
  Profile: undefined;
  ChangePassword: undefined;
};

/** The customer's Home tab: the three-service launcher and each service. */
export type HomeStackParamList = {
  CustomerHome: undefined;
  FoodHome: undefined;
  ServicePreview: { service: 'healthcare' | 'shopping' };
};

export type CustomerTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList> | undefined;
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
