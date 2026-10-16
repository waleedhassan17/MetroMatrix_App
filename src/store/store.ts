import { configureStore, combineReducers } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import autoMergeLevel2 from 'redux-persist/lib/stateReconciler/autoMergeLevel2';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { resetAllState } from './resetAllState';

// ── Global slices ──
import authReducer from '../screens/Auth/authSlice';
import { preferencesSlice } from './preferencesSlice';

// ── App-level slices ──
import { appContainerSlice } from '../components/app-container/appContainerSlice';

// ── Per-screen slices ──
// (register each screen's slice here — see CLAUDE.md "How to add a screen")
import { designGallerySlice } from '../screens/Dev/DesignGallery/designGallerySlice';
import { roleSelectionSlice } from '../screens/RoleSelection/roleSelectionSlice';
import { providerSelectionSlice } from '../screens/ProviderSelection/providerSelectionSlice';
import { signInSlice } from '../screens/Auth/SignIn/signInSlice';
import { signUpSlice } from '../screens/Auth/SignUp/signUpSlice';
import { providerSignInSlice } from '../screens/Auth/ProviderSignIn/providerSignInSlice';
import { providerSignUpSlice } from '../screens/Auth/ProviderSignUp/providerSignUpSlice';
import { forgotPasswordSlice } from '../screens/Auth/ForgotPassword/forgotPasswordSlice';
import { resetPasswordOtpSlice } from '../screens/Auth/ResetPasswordOTP/resetPasswordOtpSlice';
import { resetPasswordSlice } from '../screens/Auth/ResetPassword/resetPasswordSlice';
import { emailVerificationSlice } from '../screens/Auth/EmailVerification/emailVerificationSlice';
import { verifySuccessSlice } from '../screens/Auth/VerifySuccess/verifySuccessSlice';
import { completeProfileSlice } from '../screens/Auth/CompleteProfile/completeProfileSlice';
import { personalInfoSlice } from '../screens/Partner/PersonalInfo/personalInfoSlice';
import { providerApprovalPendingSlice } from '../screens/Partner/ProviderApprovalPending/providerApprovalPendingSlice';
import { foodHomeSlice } from '../screens/Customer/FoodHome/foodHomeSlice';
import { profileSlice } from '../screens/Account/Profile/profileSlice';
import { changePasswordSlice } from '../screens/Account/ChangePassword/changePasswordSlice';
import { adminTotpSlice } from '../screens/Admin/AdminTotp/adminTotpSlice';
import { adminTwoFactorEnrolSlice } from '../screens/Admin/AdminTwoFactorEnrol/adminTwoFactorEnrolSlice';
import { approvalQueueSlice } from '../screens/Admin/ApprovalQueue/approvalQueueSlice';
import { businessReviewSlice } from '../screens/Admin/BusinessReview/businessReviewSlice';
// Shopping (customer)
import { bagSlice } from '../screens/Shopping/Customer/Bag/bagSlice';
import { savedSlice } from '../screens/Shopping/Customer/Saved/savedSlice';
import { shoppingHomeSlice } from '../screens/Shopping/Customer/ShoppingHome/shoppingHomeSlice';
import { categoryBrowseSlice } from '../screens/Shopping/Customer/CategoryBrowse/categoryBrowseSlice';
import { storeListSlice } from '../screens/Shopping/Customer/StoreList/storeListSlice';
import { storePageSlice } from '../screens/Shopping/Customer/StorePage/storePageSlice';
import { productListSlice } from '../screens/Shopping/Customer/ProductList/productListSlice';
import { shopSearchSlice } from '../screens/Shopping/Customer/ShopSearch/shopSearchSlice';
import { productDetailSlice } from '../screens/Shopping/Customer/ProductDetail/productDetailSlice';
import { productReviewsSlice } from '../screens/Shopping/Customer/ProductReviews/productReviewsSlice';
import { checkoutSlice } from '../screens/Shopping/Customer/Checkout/checkoutSlice';
import { orderDetailSlice } from '../screens/Shopping/Customer/OrderDetail/orderDetailSlice';
import { appointmentDetailSlice } from '../screens/Health/Patient/AppointmentDetail/appointmentDetailSlice';
import { conditionListSlice } from '../screens/Health/Patient/ConditionList/conditionListSlice';
import { specialtyListSlice } from '../screens/Health/Patient/SpecialtyList/specialtyListSlice';
import { healthSearchSlice } from '../screens/Health/Patient/HealthSearch/healthSearchSlice';
import { healthHomeSlice } from '../screens/Health/Patient/HealthHome/healthHomeSlice';
import { paymentProofSlice } from '../screens/Shopping/Customer/PaymentProof/paymentProofSlice';
import { returnRequestSlice } from '../screens/Shopping/Customer/ReturnRequest/returnRequestSlice';
import { writeReviewSlice } from '../screens/Shopping/Customer/WriteReview/writeReviewSlice';
import { ordersSlice } from '../screens/Customer/Orders/ordersSlice';
// Account (core)
import { addressBookSlice } from '../screens/Account/AddressBook/addressBookSlice';
import { addressFormSlice } from '../screens/Account/AddressForm/addressFormSlice';
import { notificationsSlice } from '../screens/Account/Notifications/notificationsSlice';
// Shopping (store partner)
import { storeTodaySlice } from '../screens/Shopping/Store/StoreToday/storeTodaySlice';
import { storeOrdersSlice } from '../screens/Shopping/Store/StoreOrders/storeOrdersSlice';
import { storeOrderDetailSlice } from '../screens/Shopping/Store/StoreOrderDetail/storeOrderDetailSlice';
import { storeProductsSlice } from '../screens/Shopping/Store/StoreProducts/storeProductsSlice';
import { productFormSlice } from '../screens/Shopping/Store/ProductForm/productFormSlice';
import { inventorySlice } from '../screens/Shopping/Store/Inventory/inventorySlice';
import { collectionsSlice } from '../screens/Shopping/Store/Collections/collectionsSlice';
import { couponsSlice } from '../screens/Shopping/Store/Coupons/couponsSlice';
import { couponFormSlice } from '../screens/Shopping/Store/CouponForm/couponFormSlice';
import { storeReturnsSlice } from '../screens/Shopping/Store/StoreReturns/storeReturnsSlice';
import { storeReturnDetailSlice } from '../screens/Shopping/Store/StoreReturnDetail/storeReturnDetailSlice';
import { storeReviewsSlice } from '../screens/Shopping/Store/StoreReviews/storeReviewsSlice';
import { insightsSlice } from '../screens/Shopping/Store/Insights/insightsSlice';
import { storeProfileSlice } from '../screens/Shopping/Store/StoreProfile/storeProfileSlice';
import { storeSettingsSlice } from '../screens/Shopping/Store/StoreSettings/storeSettingsSlice';
import { paymentAccountsSlice } from '../screens/Shopping/Store/PaymentAccounts/paymentAccountsSlice';
// Shopping (admin)
import { shopOverviewSlice } from '../screens/Admin/Shopping/ShopOverview/shopOverviewSlice';
import { shopCategoriesSlice } from '../screens/Admin/Shopping/ShopCategories/shopCategoriesSlice';
import { shopBannersSlice } from '../screens/Admin/Shopping/ShopBanners/shopBannersSlice';
import { bannerFormSlice } from '../screens/Admin/Shopping/BannerForm/bannerFormSlice';
import { shopReportsSlice } from '../screens/Admin/Shopping/ShopReports/shopReportsSlice';
import { orderLookupSlice } from '../screens/Admin/Shopping/OrderLookup/orderLookupSlice';
import { shopStoresSlice } from '../screens/Admin/Shopping/ShopStores/shopStoresSlice';

// `auth` is persisted through its OWN persistReducer so that exactly one
// field reaches disk. The session (user, business, tokens) is never
// persisted: tokens live in secure-store and the user is re-fetched from
// /auth/me by bootstrapSession on every cold start.
const authPersistConfig = {
  key: 'auth',
  storage: AsyncStorage,
  whitelist: ['hasSeenOnboarding'],
};

const rootReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authReducer),
  preferences: preferencesSlice.reducer,
  appContainer: appContainerSlice.reducer,
  designGallery: designGallerySlice.reducer,
  roleSelection: roleSelectionSlice.reducer,
  providerSelection: providerSelectionSlice.reducer,
  signIn: signInSlice.reducer,
  signUp: signUpSlice.reducer,
  providerSignIn: providerSignInSlice.reducer,
  providerSignUp: providerSignUpSlice.reducer,
  forgotPassword: forgotPasswordSlice.reducer,
  resetPasswordOtp: resetPasswordOtpSlice.reducer,
  resetPassword: resetPasswordSlice.reducer,
  emailVerification: emailVerificationSlice.reducer,
  verifySuccess: verifySuccessSlice.reducer,
  completeProfile: completeProfileSlice.reducer,
  personalInfo: personalInfoSlice.reducer,
  providerApprovalPending: providerApprovalPendingSlice.reducer,
  foodHome: foodHomeSlice.reducer,
  profile: profileSlice.reducer,
  changePassword: changePasswordSlice.reducer,
  adminTotp: adminTotpSlice.reducer,
  adminTwoFactorEnrol: adminTwoFactorEnrolSlice.reducer,
  approvalQueue: approvalQueueSlice.reducer,
  businessReview: businessReviewSlice.reducer,
  // Shopping (customer)
  bag: bagSlice.reducer,
  saved: savedSlice.reducer,
  shoppingHome: shoppingHomeSlice.reducer,
  categoryBrowse: categoryBrowseSlice.reducer,
  storeList: storeListSlice.reducer,
  storePage: storePageSlice.reducer,
  productList: productListSlice.reducer,
  shopSearch: shopSearchSlice.reducer,
  productDetail: productDetailSlice.reducer,
  productReviews: productReviewsSlice.reducer,
  checkout: checkoutSlice.reducer,
  orderDetail: orderDetailSlice.reducer,
  appointmentDetail: appointmentDetailSlice.reducer,
  conditionList: conditionListSlice.reducer,
  specialtyList: specialtyListSlice.reducer,
  healthSearch: healthSearchSlice.reducer,
  healthHome: healthHomeSlice.reducer,
  paymentProof: paymentProofSlice.reducer,
  returnRequest: returnRequestSlice.reducer,
  writeReview: writeReviewSlice.reducer,
  orders: ordersSlice.reducer,
  // Account (core)
  addressBook: addressBookSlice.reducer,
  addressForm: addressFormSlice.reducer,
  notifications: notificationsSlice.reducer,
  // Shopping (store partner)
  storeToday: storeTodaySlice.reducer,
  storeOrders: storeOrdersSlice.reducer,
  storeOrderDetail: storeOrderDetailSlice.reducer,
  storeProducts: storeProductsSlice.reducer,
  productForm: productFormSlice.reducer,
  inventory: inventorySlice.reducer,
  collections: collectionsSlice.reducer,
  coupons: couponsSlice.reducer,
  couponForm: couponFormSlice.reducer,
  storeReturns: storeReturnsSlice.reducer,
  storeReturnDetail: storeReturnDetailSlice.reducer,
  storeReviews: storeReviewsSlice.reducer,
  insights: insightsSlice.reducer,
  storeProfile: storeProfileSlice.reducer,
  storeSettings: storeSettingsSlice.reducer,
  paymentAccounts: paymentAccountsSlice.reducer,
  // Shopping (admin)
  shopOverview: shopOverviewSlice.reducer,
  shopCategories: shopCategoriesSlice.reducer,
  shopBanners: shopBannersSlice.reducer,
  bannerForm: bannerFormSlice.reducer,
  shopReports: shopReportsSlice.reducer,
  orderLookup: orderLookupSlice.reducer,
  shopStores: shopStoresSlice.reducer,
});

type RootReducerState = ReturnType<typeof rootReducer>;

// Slices that describe the app process / the device rather than the account.
// They survive every RESET_ALL_STATE.
//
// `appContainer` MUST survive: AppContainer dispatches bootstrapSession()
// once, on mount. Resetting the slice to its initialState (isAppReady: false)
// while AppContainer stays mounted would leave the app on the native splash
// forever, on every sign-out AND on the 401 session-expired bridge.
//
// `auth` is passed through as well, but it is NOT a survivor: authSlice
// handles RESET_ALL_STATE itself (back to signed-out, keeping
// hasSeenOnboarding) — passing it through also keeps its `_persist` marker.
const SHELL_SLICES = ['appContainer', 'preferences', 'auth'] as const;

// Applied at the root so a slice added later is account-scoped by default —
// nobody has to remember to add it to a reset list.
const appReducer: typeof rootReducer = (state, action) => {
  if (state && action.type === resetAllState.type) {
    const kept: Partial<RootReducerState> = {};
    for (const key of SHELL_SLICES) {
      (kept as Record<string, unknown>)[key] = state[key];
    }
    return rootReducer(kept as RootReducerState, action);
  }
  return rootReducer(state, action);
};

const persistConfig = {
  key: 'metromatrix-root',
  storage: AsyncStorage,
  // Only device preferences at the root. `auth` persists its one field via
  // its nested config above; everything else is refetched from the API.
  whitelist: ['preferences'],
  stateReconciler: autoMergeLevel2 as any,
};

const persistedReducer = persistReducer(persistConfig, appReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      immutableCheck: { warnAfter: 128 },
      serializableCheck: {
        warnAfter: 128,
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
