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
import type { AppointmentSegment, ConsultKind } from './health';

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
  /** "I've paid": a shop order's transfer, or an appointment's. */
  PaymentProof: { orderId: string; groupCode: string } | { appointmentCode: string };
};

/**
 * The patient's Health screens that any customer stack can push (Home, Orders,
 * Profile), so a visit, a prescription or a record opens where you are.
 */
export type HealthBrowseParamList = {
  HealthSearch: { q?: string } | undefined;
  SpecialtyList: undefined;
  ConditionList: undefined;
  /** The list's context (specialty, condition, a search) and any preset filter. */
  DoctorList: { specialty?: string; condition?: string; q?: string; title?: string; kind?: ConsultKind; availableToday?: boolean } | undefined;
  /** `locationId`/`kind` preselect how the patient wants to be seen. */
  DoctorProfile: { id: string; name?: string; locationId?: string; kind?: ConsultKind };
  DoctorReviews: { doctorId: string; name?: string };
  BookingConfirmed: { code: string };
  AppointmentDetail: { code: string };
  /** The patient joins by appointment code, the doctor by appointment id. */
  VideoPrecheck: { code?: string; appointmentId?: string };
  VideoConsult: { code?: string; appointmentId?: string };
  PostConsultReview: { code: string };
  PrescriptionList: undefined;
  PrescriptionView: { id: string };
  HealthRecords: { memberId?: string } | undefined;
  RecordDetail: { id: string };
  /** `attachTo`: an appointment code the new record is shared with afterwards. */
  RecordUpload: { memberId?: string; attachTo?: string } | undefined;
  FamilyMembers: undefined;
  FamilyMemberForm: { id?: string } | undefined;
  SymptomChecker: undefined;
  SymptomResult: undefined;
  Emergency: undefined;
};

/** Profile tab stack — shared by every role app. */
export type AccountStackParamList = ShopBrowseParamList & HealthBrowseParamList & {
  Profile: undefined;
  ChangePassword: undefined;
  Saved: undefined;
  AddressBook: undefined;
};

/** The customer's Home tab: the three-service launcher and each service. */
export type HomeStackParamList = ShopBrowseParamList & HealthBrowseParamList & {
  CustomerHome: undefined;
  HealthHome: undefined;
  FoodHome: undefined;
  ServicePreview: { service: 'healthcare' | 'shopping' };
  ShoppingHome: undefined;
  CategoryBrowse: { categoryId?: string } | undefined;
  StoreList: undefined;
  /** Scoped to one store when opened from its page. */
  ShopSearch: { q?: string; storeId?: string; storeName?: string } | undefined;
};

/** The customer's Orders tab: Shop / Health / Food, then an order and its steps. */
export type OrdersStackParamList = ShopBrowseParamList & HealthBrowseParamList & {
  /** `service`: the segment to open on (Shop, Health or Food); `visits`: Health's Upcoming / Past. */
  Orders: { segment?: OrderSegment; service?: 'shop' | 'health' | 'food'; visits?: AppointmentSegment } | undefined;
  OrderDetail: { groupCode: string };
  ReturnRequest: { orderId: string; groupCode: string };
  WriteReview: { orderId: string; itemId: string; groupCode: string };
};

export type CustomerTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList> | undefined;
  OrdersTab: NavigatorScreenParams<OrdersStackParamList> | undefined;
  ProfileTab: NavigatorScreenParams<AccountStackParamList> | undefined;
};

// ─── The customer app, the FYP's way ──────────────────
// A root stack (the three-card home and the account pages) and one app per
// service, each a stack over its own bottom tabs. A tab root carries
// `asTab`, so it hides the back control a pushed copy of it shows.

export type TabRootParams = { asTab?: boolean } | undefined;

export type HealthTabParamList = {
  HealthHomeTab: TabRootParams;
  AppointmentsTab: { asTab?: boolean; visits?: AppointmentSegment } | undefined;
  RecordsTab: { asTab?: boolean; memberId?: string } | undefined;
  HealthProfileTab: TabRootParams;
};

export type ShopTabParamList = {
  ShopHomeTab: TabRootParams;
  BagTab: TabRootParams;
  SavedTab: TabRootParams;
  ShopOrdersTab: { asTab?: boolean; segment?: OrderSegment } | undefined;
};

export type FoodTabParamList = {
  FoodHomeTab: TabRootParams;
  FoodOrdersTab: TabRootParams;
  FoodProfileTab: TabRootParams;
};

export type HealthAppParamList = HealthBrowseParamList & {
  HealthTabs: NavigatorScreenParams<HealthTabParamList> | undefined;
};

export type ShopAppParamList = ShopBrowseParamList & {
  ShopTabs: NavigatorScreenParams<ShopTabParamList> | undefined;
  CategoryBrowse: { categoryId?: string } | undefined;
  StoreList: undefined;
  ShopSearch: { q?: string; storeId?: string; storeName?: string } | undefined;
  OrderDetail: { groupCode: string };
  ReturnRequest: { orderId: string; groupCode: string };
  WriteReview: { orderId: string; itemId: string; groupCode: string };
};

export type FoodAppParamList = {
  FoodTabs: NavigatorScreenParams<FoodTabParamList> | undefined;
};

export type CustomerStackParamList = {
  CustomerHome: undefined;
  ServicePreview: { service: 'healthcare' | 'shopping' };
  Orders: OrdersStackParamList['Orders'];
  Profile: undefined;
  ChangePassword: undefined;
  AddressBook: undefined;
  AddressForm: { id?: string } | undefined;
  Notifications: undefined;
  HealthApp: NavigatorScreenParams<HealthAppParamList> | undefined;
  ShopApp: NavigatorScreenParams<ShopAppParamList> | undefined;
  FoodApp: NavigatorScreenParams<FoodAppParamList> | undefined;
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

/** The doctor's four tabs. */
export type DoctorTabParamList = {
  TodayTab: undefined;
  CalendarTab: undefined;
  PatientsTab: undefined;
  MoreTab: undefined;
};

/** The doctor's app: the tabs (or Practice setup, until listed), with every tool pushed over them. */
export type DoctorPartnerStackParamList = {
  DoctorTabs: NavigatorScreenParams<DoctorTabParamList> | undefined;
  PracticeSetup: undefined;
  Availability: { locationId?: string; tab?: 'locations' | 'hours' | 'preview' } | undefined;
  TimeOff: { date?: string } | undefined;
  DoctorAppointment: { id: string };
  PrescriptionWriter: { appointmentId: string };
  PatientHistory: { id: string; name?: string };
  MyReviews: undefined;
  DoctorInsights: undefined;
  DoctorProfileEdit: undefined;
  PaymentAccounts: undefined;
  VideoPrecheck: { code?: string; appointmentId?: string };
  VideoConsult: { code?: string; appointmentId?: string };
  Profile: undefined;
  ChangePassword: undefined;
  Notifications: undefined;
};

/** The admin console's Health tab. */
export type AdminHealthStackParamList = {
  HealthOverview: undefined;
  Specialties: undefined;
  Conditions: undefined;
  DoctorVerification: { businessId?: string } | undefined;
  ReviewModeration: undefined;
  AppointmentLookup: { code?: string } | undefined;
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
  HealthAdminTab: NavigatorScreenParams<AdminHealthStackParamList> | undefined;
  ProfileTab: NavigatorScreenParams<AccountStackParamList> | undefined;
};
