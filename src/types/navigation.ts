// ═══════════════════════════════════════════════════════
// MetroMatrix — Navigation param lists
// ═══════════════════════════════════════════════════════
// One entry per route name in navigations-maps/Base.ts. Params are optional
// unless a screen genuinely cannot render without them: under React
// Navigation v7 a navigate() to a non-focused route PUSHES a fresh route, so
// its params are exactly what that caller passed.

import type { NavigatorScreenParams } from '@react-navigation/native';
import type { DocumentKind } from './auth';
import type { OrderSegment, ProductSort } from './shopping';

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

/**
 * The customer's Shopping screens that any customer stack can push, so a
 * product opens where you are (Home, Orders or Profile). Params are flat
 * strings and numbers only: on web they become the URL.
 */
export type ShopBrowseParamList = {
  StorePage: { slug: string; name?: string };
  /** One product list for every entry: a collection, a category, "New this week", a search. */
  ProductList: {
    title: string;
    q?: string;
    storeId?: string;
    categoryId?: string;
    collectionId?: string;
    sort?: ProductSort;
    onSale?: boolean;
  };
  ProductDetail: { id: string; name?: string };
  ProductReviews: { productId: string; name?: string };
  Bag: undefined;
  Checkout: undefined;
  OrderPlaced: { groupCode: string };
  AddressForm: { id?: string } | undefined;
  Notifications: undefined;
};

/** Profile tab stack — shared by every role app. */
export type AccountStackParamList = ShopBrowseParamList & {
  Profile: undefined;
  ChangePassword: undefined;
  Saved: undefined;
  AddressBook: undefined;
};

/** The customer's Home tab: the three-service launcher and each service. */
export type HomeStackParamList = ShopBrowseParamList & {
  CustomerHome: undefined;
  FoodHome: undefined;
  ServicePreview: { service: 'healthcare' | 'shopping' };
  ShoppingHome: undefined;
  CategoryBrowse: { categoryId?: string } | undefined;
  StoreList: undefined;
  ShopSearch: { q?: string } | undefined;
};

/** The customer's Orders tab: Shop / Health / Food, then an order and its steps. */
export type OrdersStackParamList = ShopBrowseParamList & {
  Orders: { segment?: OrderSegment } | undefined;
  OrderDetail: { groupCode: string };
  PaymentProof: { orderId: string; groupCode: string };
  ReturnRequest: { orderId: string; groupCode: string };
  WriteReview: { orderId: string; itemId: string; groupCode: string };
};

export type CustomerTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList> | undefined;
  OrdersTab: NavigatorScreenParams<OrdersStackParamList> | undefined;
  ProfileTab: NavigatorScreenParams<AccountStackParamList> | undefined;
};

/** The store partner's four tabs. */
export type StoreTabParamList = {
  HomeTab: undefined;
  OrdersTab: undefined;
  ProductsTab: undefined;
  MoreTab: undefined;
};

/** The store partner's app: the tabs, with every tool pushed over them. */
export type StorePartnerStackParamList = {
  StoreTabs: NavigatorScreenParams<StoreTabParamList> | undefined;
  StoreOrderDetail: { id: string; code?: string };
  ProductForm: { id?: string } | undefined;
  Inventory: { lowStock?: boolean } | undefined;
  Collections: undefined;
  Coupons: undefined;
  CouponForm: { id?: string } | undefined;
  StoreReturns: undefined;
  StoreReturnDetail: { id: string };
  StoreReviews: undefined;
  Insights: undefined;
  StoreProfile: undefined;
  StoreSettings: undefined;
  PaymentAccounts: undefined;
  Profile: undefined;
  ChangePassword: undefined;
  Notifications: undefined;
};

/** The admin console's Shopping tab. */
export type AdminShopStackParamList = {
  ShopOverview: undefined;
  ShopCategories: undefined;
  ShopBanners: undefined;
  BannerForm: { id?: string } | undefined;
  ShopReports: undefined;
  OrderLookup: { groupCode?: string } | undefined;
  ShopStores: undefined;
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
  ShopAdminTab: NavigatorScreenParams<AdminShopStackParamList> | undefined;
  ProfileTab: NavigatorScreenParams<AccountStackParamList> | undefined;
};
