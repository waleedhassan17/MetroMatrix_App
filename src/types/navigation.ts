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
import type { AdminVendorStatus, KitchenKind } from './food';
import type { VoiceQtyLine } from './kitchen';

/** BaseNavigator: onboarding, sign-in and every session gate. */
export type RootStackParamList = {
  Onboarding: undefined;
  /** A kitchen's own page from its link or QR (`via: 'qr'` from a scan). */
  PublicStore: { slug: string; via?: 'qr' | 'link' };
  RoleSelection: undefined;
  ProviderSelection: undefined;
  SignIn: { email?: string } | undefined;
  SignUp: undefined;
  ProviderSignIn: { email?: string } | undefined;
  RiderSignIn: undefined;
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
export type AuthUserType = 'user' | 'provider' | 'rider';

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
  PaymentProof:
    | { orderId: string; groupCode: string }
    | { appointmentCode: string }
    | { foodOrderCode: string }
    | { surplusCode: string }
    | { tiffinPeriodId: string; tiffinCode: string }
    | { cateringCode: string };
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
  /** A list of vendors: a cuisine, a home rail's "See all", or pick-up places. */
  FoodVendors: { title?: string; cuisine?: string; rail?: string; pickup?: boolean } | undefined;
  FoodSearch: { q?: string } | undefined;
  /** A vendor's page (by slug); `dish` opens that dish's sheet. */
  /** `via`: opened from the kitchen's own link or QR (/s/:slug while signed in). */
  FoodVendor: { slug: string; dish?: string; via?: 'qr' | 'link' };
  FoodBag: undefined;
  FoodCheckout: undefined;
  /** Straight after checkout: the order's code (its page reads the rest). */
  FoodOrderPlaced: { code: string };
  /** One order, live. */
  FoodOrder: { code: string };
  /** The kitchens the customer saved. */
  FoodFavourites: undefined;
  /** "I've paid": a transfer's reference for the kitchen (an order, or a Bachat Box reservation). */
  PaymentProof: { foodOrderCode: string } | { surplusCode: string } | { tiffinPeriodId: string; tiffinCode: string } | { cateringCode: string };
  /** Rate an order once it arrived; `stars` when the order page's stars were tapped. */
  FoodRateOrder: { code: string; stars?: number };
  /** A kitchen's reviews (by vendor id); `slug` leads back to its page. */
  FoodReviews: { id: string; name?: string; slug?: string };
  // ── Bachat Box (Kitchen Intelligence) ──
  FoodSurplusList: undefined;
  FoodSurplus: { id: string };
  /** A reservation's pickup code; `fresh` straight after reserving. */
  FoodSurplusReserved: { code: string; fresh?: boolean };
  FoodSurplusReservations: undefined;
  // ── Tiffin and catering (5B) ──
  FoodTiffinPlan: { id: string };
  FoodTiffins: undefined;
  /** A subscription; `fresh` straight after requesting it. */
  FoodTiffin: { code: string; fresh?: boolean };
  /** "Plan a dawat" with a kitchen (by slug; its name while it loads). */
  FoodCateringForm: { slug: string; name?: string };
  FoodCateringRequests: undefined;
  FoodCateringRequest: { code: string; fresh?: boolean };
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
  /** Dev builds only: the Food foundation check (/dev/realtime). */
  RealtimeCheck: undefined;
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

/** The Food vendor's tabs: Orders (Today first for home kitchens) · Menu · Riders · More. */
export type FoodVendorTabParamList = {
  TodayTab: undefined;
  OrdersTab: undefined;
  MenuTab: undefined;
  KitchenTab: undefined;
  RidersTab: undefined;
  MoreTab: undefined;
};

/** The Food vendor's app: the tabs (or Setup, until live), with every tool pushed over them. */
export type FoodVendorStackParamList = {
  VendorTabs: NavigatorScreenParams<FoodVendorTabParamList> | undefined;
  VendorSetup: undefined;
  VendorBrand: undefined;
  VendorSettings: undefined;
  VendorHours: undefined;
  VendorZones: undefined;
  VendorClosures: undefined;
  VendorPlan: undefined;
  VendorRiderDetail: { id: string };
  /** A dish: edit one (`id`), or a new one (optionally in `categoryId`). */
  VendorMenuItem: { id?: string; categoryId?: string } | undefined;
  VendorCategories: undefined;
  VendorOptionGroups: undefined;
  /** An add-on group: edit one (`id`) or a new one. */
  VendorOptionGroup: { id?: string } | undefined;
  VendorWeeklyMenu: undefined;
  VendorPreorderSlots: undefined;
  VendorPromotions: undefined;
  /** A deal: edit one (`id`) or a new one. */
  VendorPromotion: { id?: string } | undefined;
  /** One order (by id); `assign` opens the rider picker; `packing` opens on the packing photo (asked for before Ready). */
  VendorOrder: { id: string; assign?: boolean; packing?: boolean };
  VendorReviews: undefined;
  VendorInsights: undefined;
  /** A home kitchen's Menu and Riders (tabs for the others). */
  VendorMenuPage: undefined;
  VendorRidersPage: undefined;
  // ── Kitchen Intelligence ──
  /** Stock; `segment` opens on one (from a hub tile or a card). */
  KitchenStock: { segment?: 'all' | 'low' | 'expiring' | 'negative' } | undefined;
  /** A count; `ingredientIds` are listed first (a "below zero" card). */
  KitchenStockTake: { ingredientIds?: string[] } | undefined;
  KitchenIngredient: { id: string };
  /** Edit an ingredient (`id`) or add one (optionally named). */
  KitchenIngredientForm: { id?: string; name?: string } | undefined;
  KitchenRecipes: { needsRecipe?: boolean } | undefined;
  /** A dish's recipe card, for one size (default: its first). */
  KitchenRecipe: { itemId: string; variantId?: string | null };
  KitchenPurchases: undefined;
  KitchenPurchase: { id: string };
  /** A new purchase; `draft` carries spoken lines to check (Edit on a voice card). */
  KitchenPurchaseForm: { scan?: boolean; draft?: VoiceQtyLine[] } | undefined;
  KitchenSuppliers: undefined;
  KitchenPriceWatch: undefined;
  KitchenForecast: { date?: string; tab?: 'forecast' | 'prep' | 'shopping' } | undefined;
  KitchenWaste: undefined;
  KitchenWasteForm: undefined;
  /** A new Bachat Box; `suggest` fills it from the end-of-day suggestion. */
  KitchenBoxForm: { suggest?: boolean } | undefined;
  KitchenBox: { id: string };
  KitchenDonations: undefined;
  KitchenSettings: undefined;
  // ── The assistant (5C) ──
  KitchenAssistant: undefined;
  KitchenAiDescriptions: undefined;
  /** From an expiring-stock card: those ingredients. */
  KitchenAiSpecials: { ingredientIds?: string[] } | undefined;
  KitchenAiCombos: undefined;
  KitchenAiPhotoCheck: { itemId?: string } | undefined;
  KitchenReviewInsights: undefined;
  KitchenReviewTheme: { theme: string; label?: string; week?: string };
  KitchenNutrition: undefined;
  // ── Growth (5B) ──
  GrowthTiffin: undefined;
  /** Edit a plan (`id`) or a new one. */
  GrowthTiffinPlanForm: { id?: string } | undefined;
  /** Subscriptions: one plan's, or all; `status` opens on a tab ("pending" from a card). */
  GrowthTiffinSubscribers: { planId?: string; status?: 'pending' | 'active' | 'paused' | 'ended' } | undefined;
  GrowthCatering: { status?: 'new' | 'quoted' | 'confirmed' | 'past' } | undefined;
  GrowthCateringRequest: { code: string };
  /** A new quote (version) for a request. */
  GrowthQuote: { code: string };
  GrowthRamadan: undefined;
  GrowthStorefront: undefined;
  GrowthDemand: undefined;
  /** `itemId` opens that dish's sheet. */
  GrowthMenuInsights: { itemId?: string } | undefined;
  GrowthExperiment: { id: string };
  /** `focus: 'hygiene'` puts the checklist first. */
  GrowthStory: { focus?: 'story' | 'hygiene' } | undefined;
  PaymentAccounts: undefined;
  Profile: undefined;
  ChangePassword: undefined;
  Notifications: undefined;
};

/** The rider's tabs. */
export type RiderTabParamList = {
  DeliveriesTab: undefined;
  CashTab: undefined;
  RiderProfileTab: undefined;
};

/** The rider's app: the tabs, with the few tools pushed over them. */
export type RiderStackParamList = {
  RiderTabs: NavigatorScreenParams<RiderTabParamList> | undefined;
  /** One delivery (by order id). */
  RiderOrder: { id: string };
  ChangePassword: undefined;
  Notifications: undefined;
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

/** The admin console's Food tab. */
export type AdminFoodStackParamList = {
  FoodOverview: undefined;
  /** Filters set once by a link (the overview's food-safety notice). */
  AdminFoodVendors: { type?: KitchenKind; status?: AdminVendorStatus } | undefined;
  /** `featured` from the list row (the detail doesn't carry it). */
  AdminFoodVendor: { id: string; name?: string; featured?: boolean };
  AdminFoodOrders: { code?: string; vendorId?: string; name?: string } | undefined;
  AdminFoodOrder: { id: string; code?: string };
  AdminFoodReviews: { vendorId?: string; name?: string } | undefined;
  AdminFoodCuisines: undefined;
  AdminFoodBanners: undefined;
  AdminFoodBannerForm: { id?: string } | undefined;
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
  FoodAdminTab: NavigatorScreenParams<AdminFoodStackParamList> | undefined;
  ProfileTab: NavigatorScreenParams<AccountStackParamList> | undefined;
};
