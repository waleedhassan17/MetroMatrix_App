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

  // ── Shopping: customer. The browse screens are mounted in the Home, Orders
  // and Profile stacks alike, so a product opens where you are. ──
  SHOPPING_HOME: 'ShoppingHome',
  CATEGORY_BROWSE: 'CategoryBrowse',
  STORE_LIST: 'StoreList',
  STORE_PAGE: 'StorePage',
  PRODUCT_LIST: 'ProductList',
  SHOP_SEARCH: 'ShopSearch',
  PRODUCT_DETAIL: 'ProductDetail',
  PRODUCT_REVIEWS: 'ProductReviews',
  BAG: 'Bag',
  CHECKOUT: 'Checkout',
  ORDER_PLACED: 'OrderPlaced',
  ORDER_DETAIL: 'OrderDetail',
  PAYMENT_PROOF: 'PaymentProof',
  RETURN_REQUEST: 'ReturnRequest',
  WRITE_REVIEW: 'WriteReview',
  SAVED: 'Saved',
  ADDRESS_BOOK: 'AddressBook',
  ADDRESS_FORM: 'AddressForm',
  NOTIFICATIONS: 'Notifications',

  // ── Shopping: the store partner's app (a stack over four tabs) ──
  STORE_TABS: 'StoreTabs',
  PRODUCTS_TAB: 'ProductsTab',
  MORE_TAB: 'MoreTab',
  STORE_TODAY: 'StoreToday',
  STORE_ORDERS: 'StoreOrders',
  STORE_ORDER_DETAIL: 'StoreOrderDetail',
  STORE_PRODUCTS: 'StoreProducts',
  PRODUCT_FORM: 'ProductForm',
  INVENTORY: 'Inventory',
  COLLECTIONS: 'Collections',
  COUPONS: 'Coupons',
  COUPON_FORM: 'CouponForm',
  STORE_RETURNS: 'StoreReturns',
  STORE_RETURN_DETAIL: 'StoreReturnDetail',
  STORE_REVIEWS: 'StoreReviews',
  INSIGHTS: 'Insights',
  STORE_PROFILE: 'StoreProfile',
  STORE_SETTINGS: 'StoreSettings',
  PAYMENT_ACCOUNTS: 'PaymentAccounts',
  STORE_MORE: 'StoreMore',

  // ── Shopping: the admin console's tab ──
  SHOP_ADMIN_TAB: 'ShopAdminTab',
  SHOP_OVERVIEW: 'ShopOverview',
  SHOP_CATEGORIES: 'ShopCategories',
  SHOP_BANNERS: 'ShopBanners',
  BANNER_FORM: 'BannerForm',
  SHOP_REPORTS: 'ShopReports',
  ORDER_LOOKUP: 'OrderLookup',
  SHOP_STORES: 'ShopStores',

  // ── Dev only ──
  DESIGN_GALLERY: 'DesignGallery',
} as const;

export type RouteName = (typeof ROUTES)[keyof typeof ROUTES];
