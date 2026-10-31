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
import authReducer from './authSlice';
import { preferencesSlice } from './preferencesSlice';
import { realtimeSlice } from './realtimeSlice';
import { platformConfigSlice } from './platformConfigSlice';

// ── App-level slices ──
import { appContainerSlice } from '../Components/appContainerSlice';
import { voiceSlice } from '../Components/voice/voiceSlice';

// ── Per-screen slices ──
// (register each screen's slice here — see CLAUDE.md "How to add a screen")
import { designGallerySlice } from '../screens/design-gallery-screen/designGallerySlice';
import { roleSelectionSlice } from '../screens/role-selection-screen/roleSelectionSlice';
import { providerSelectionSlice } from '../screens/provider-selection-screen/providerSelectionSlice';
import { signInSlice } from '../screens/sign-in-screen/signInSlice';
import { signUpSlice } from '../screens/sign-up-screen/signUpSlice';
import { providerSignInSlice } from '../screens/provider-sign-in-screen/providerSignInSlice';
import { riderSignInSlice } from '../screens/rider-sign-in-screen/riderSignInSlice';
import { providerSignUpSlice } from '../screens/provider-sign-up-screen/providerSignUpSlice';
import { forgotPasswordSlice } from '../screens/forgot-password-screen/forgotPasswordSlice';
import { resetPasswordOtpSlice } from '../screens/reset-password-otp-screen/resetPasswordOtpSlice';
import { resetPasswordSlice } from '../screens/reset-password-screen/resetPasswordSlice';
import { emailVerificationSlice } from '../screens/email-verification-screen/emailVerificationSlice';
import { verifySuccessSlice } from '../screens/verify-success-screen/verifySuccessSlice';
import { completeProfileSlice } from '../screens/complete-profile-screen/completeProfileSlice';
import { personalInfoSlice } from '../screens/personal-info-screen/personalInfoSlice';
import { providerApprovalPendingSlice } from '../screens/provider-approval-pending-screen/providerApprovalPendingSlice';
import { foodHomeSlice } from '../screens/food-home-screen/foodHomeSlice';
import { foodVendorsSlice } from '../screens/food-vendors-screen/foodVendorsSlice';
import { foodSearchSlice } from '../screens/food-search-screen/foodSearchSlice';
import { foodVendorSlice } from '../screens/food-vendor-screen/foodVendorSlice';
import { itemSheetSlice } from '../screens/food-vendor-screen/itemSheetSlice';
import { foodBagSlice } from '../screens/food-bag-screen/foodBagSlice';
import { foodCheckoutSlice } from '../screens/food-checkout-screen/foodCheckoutSlice';
import { foodOrderSlice } from '../screens/food-order-screen/foodOrderSlice';
import { foodFavouritesSlice } from '../screens/food-favourites-screen/foodFavouritesSlice';
import { foodRateOrderSlice } from '../screens/food-rate-order-screen/foodRateOrderSlice';
import { vendorReviewsSlice } from '../screens/vendor-reviews-screen/vendorReviewsSlice';
import { vendorInsightsSlice } from '../screens/vendor-insights-screen/vendorInsightsSlice';
import { foodOverviewSlice } from '../screens/food-overview-screen/foodOverviewSlice';
import { adminFoodVendorsSlice } from '../screens/admin-food-vendors-screen/adminFoodVendorsSlice';
import { adminFoodVendorSlice } from '../screens/admin-food-vendor-screen/adminFoodVendorSlice';
import { adminFoodOrdersSlice } from '../screens/admin-food-orders-screen/adminFoodOrdersSlice';
import { adminFoodOrderSlice } from '../screens/admin-food-order-screen/adminFoodOrderSlice';
import { adminFoodReviewsSlice } from '../screens/admin-food-reviews-screen/adminFoodReviewsSlice';
import { adminFoodCuisinesSlice } from '../screens/admin-food-cuisines-screen/adminFoodCuisinesSlice';
import { adminFoodBannersSlice } from '../screens/admin-food-banners-screen/adminFoodBannersSlice';
import { adminFoodBannerFormSlice } from '../screens/admin-food-banner-form-screen/adminFoodBannerFormSlice';
import { adminKitchenAiSlice } from '../screens/admin-kitchen-ai-screen/adminKitchenAiSlice';
import { adminKitchenPricesSlice } from '../screens/admin-kitchen-prices-screen/adminKitchenPricesSlice';
import { adminKitchenNutritionSlice } from '../screens/admin-kitchen-nutrition-screen/adminKitchenNutritionSlice';
import { adminKitchenAliasesSlice } from '../screens/admin-kitchen-aliases-screen/adminKitchenAliasesSlice';
import { adminKitchenCalendarSlice } from '../screens/admin-kitchen-calendar-screen/adminKitchenCalendarSlice';
import { adminKitchenHygieneSlice } from '../screens/admin-kitchen-hygiene-screen/adminKitchenHygieneSlice';
import { adminKitchenSignaturesSlice } from '../screens/admin-kitchen-signatures-screen/adminKitchenSignaturesSlice';
import { adminKitchenDemandSlice } from '../screens/admin-kitchen-demand-screen/adminKitchenDemandSlice';
import { adminKitchenLookupSlice } from '../screens/admin-kitchen-lookup-screen/adminKitchenLookupSlice';
import { vendorPromotionsSlice } from '../screens/vendor-promotions-screen/vendorPromotionsSlice';
import { vendorPromotionSlice } from '../screens/vendor-promotion-screen/vendorPromotionSlice';
import { vendorBoardSlice } from '../screens/vendor-orders-screen/vendorBoardSlice';
import { vendorOrderSlice } from '../screens/vendor-order-screen/vendorOrderSlice';
import { riderOrderSlice } from '../screens/rider-order-screen/riderOrderSlice';
import { riderCashSlice } from '../screens/rider-cash-screen/riderCashSlice';
import { profileSlice } from '../screens/profile-screen/profileSlice';
import { changePasswordSlice } from '../screens/change-password-screen/changePasswordSlice';
import { adminTotpSlice } from '../screens/admin-totp-screen/adminTotpSlice';
import { adminTwoFactorEnrolSlice } from '../screens/admin-two-factor-enrol-screen/adminTwoFactorEnrolSlice';
import { approvalQueueSlice } from '../screens/approval-queue-screen/approvalQueueSlice';
import { businessReviewSlice } from '../screens/business-review-screen/businessReviewSlice';
// Shopping (customer)
import { bagSlice } from '../screens/bag-screen/bagSlice';
import { savedSlice } from '../screens/saved-screen/savedSlice';
import { shoppingHomeSlice } from '../screens/shopping-home-screen/shoppingHomeSlice';
import { categoryBrowseSlice } from '../screens/category-browse-screen/categoryBrowseSlice';
import { storeListSlice } from '../screens/store-list-screen/storeListSlice';
import { storePageSlice } from '../screens/store-page-screen/storePageSlice';
import { productListSlice } from '../screens/product-list-screen/productListSlice';
import { shopSearchSlice } from '../screens/shop-search-screen/shopSearchSlice';
import { productDetailSlice } from '../screens/product-detail-screen/productDetailSlice';
import { productReviewsSlice } from '../screens/product-reviews-screen/productReviewsSlice';
import { checkoutSlice } from '../screens/checkout-screen/checkoutSlice';
import { orderDetailSlice } from '../screens/order-detail-screen/orderDetailSlice';
import { appointmentDetailSlice } from '../screens/appointment-detail-screen/appointmentDetailSlice';
import { appointmentLookupSlice } from '../screens/appointment-lookup-screen/appointmentLookupSlice';
import { reviewModerationSlice } from '../screens/review-moderation-screen/reviewModerationSlice';
import { doctorVerificationSlice } from '../screens/doctor-verification-screen/doctorVerificationSlice';
import { conditionsSlice } from '../screens/conditions-screen/conditionsSlice';
import { specialtiesSlice } from '../screens/specialties-screen/specialtiesSlice';
import { healthOverviewSlice } from '../screens/health-overview-screen/healthOverviewSlice';
import { doctorCalendarSlice } from '../screens/doctor-calendar-screen/doctorCalendarSlice';
import { doctorInsightsSlice } from '../screens/doctor-insights-screen/doctorInsightsSlice';
import { myReviewsSlice } from '../screens/my-reviews-screen/myReviewsSlice';
import { patientHistorySlice } from '../screens/patient-history-screen/patientHistorySlice';
import { doctorPatientsSlice } from '../screens/doctor-patients-screen/doctorPatientsSlice';
import { prescriptionWriterSlice } from '../screens/prescription-writer-screen/prescriptionWriterSlice';
import { doctorAppointmentSlice } from '../screens/doctor-appointment-screen/doctorAppointmentSlice';
import { doctorTodaySlice } from '../screens/doctor-today-screen/doctorTodaySlice';
import { timeOffSlice } from '../screens/time-off-screen/timeOffSlice';
import { availabilitySlice } from '../screens/availability-screen/availabilitySlice';
import { doctorProfileEditSlice } from '../screens/doctor-profile-edit-screen/doctorProfileEditSlice';
import { practiceSetupSlice } from '../screens/practice-setup-screen/practiceSetupSlice';
import { videoSlice } from '../screens/video-precheck-screen/videoSlice';
import { postConsultReviewSlice } from '../screens/post-consult-review-screen/postConsultReviewSlice';
import { symptomCheckerSlice } from '../screens/symptom-checker-screen/symptomCheckerSlice';
import { recordUploadSlice } from '../screens/record-upload-screen/recordUploadSlice';
import { recordDetailSlice } from '../screens/record-detail-screen/recordDetailSlice';
import { healthRecordsSlice } from '../screens/health-records-screen/healthRecordsSlice';
import { prescriptionViewSlice } from '../screens/prescription-view-screen/prescriptionViewSlice';
import { doctorReviewsSlice } from '../screens/doctor-reviews-screen/doctorReviewsSlice';
import { bookAppointmentSlice } from '../screens/book-appointment-sheet/bookAppointmentSlice';
import { familyMemberFormSlice } from '../screens/family-member-form-screen/familyMemberFormSlice';
import { familySlice } from '../screens/family-members-screen/familySlice';
import { doctorProfileSlice } from '../screens/doctor-profile-screen/doctorProfileSlice';
import { doctorListSlice } from '../screens/doctor-list-screen/doctorListSlice';
import { conditionListSlice } from '../screens/condition-list-screen/conditionListSlice';
import { specialtyListSlice } from '../screens/specialty-list-screen/specialtyListSlice';
import { healthSearchSlice } from '../screens/health-search-screen/healthSearchSlice';
import { healthHomeSlice } from '../screens/health-home-screen/healthHomeSlice';
import { paymentProofSlice } from '../screens/payment-proof-screen/paymentProofSlice';
import { returnRequestSlice } from '../screens/return-request-screen/returnRequestSlice';
import { writeReviewSlice } from '../screens/write-review-screen/writeReviewSlice';
import { ordersSlice } from '../screens/orders-screen/ordersSlice';
// Account (core)
import { addressBookSlice } from '../screens/address-book-screen/addressBookSlice';
import { addressFormSlice } from '../screens/address-form-screen/addressFormSlice';
import { notificationsSlice } from '../screens/notifications-screen/notificationsSlice';
// Shopping (store partner)
import { storeTodaySlice } from '../screens/store-today-screen/storeTodaySlice';
import { storeOrdersSlice } from '../screens/store-orders-screen/storeOrdersSlice';
import { storeOrderDetailSlice } from '../screens/store-order-detail-screen/storeOrderDetailSlice';
import { storeProductsSlice } from '../screens/store-products-screen/storeProductsSlice';
import { productFormSlice } from '../screens/product-form-screen/productFormSlice';
import { inventorySlice } from '../screens/inventory-screen/inventorySlice';
import { collectionsSlice } from '../screens/collections-screen/collectionsSlice';
import { couponsSlice } from '../screens/coupons-screen/couponsSlice';
import { couponFormSlice } from '../screens/coupon-form-screen/couponFormSlice';
import { storeReturnsSlice } from '../screens/store-returns-screen/storeReturnsSlice';
import { storeReturnDetailSlice } from '../screens/store-return-detail-screen/storeReturnDetailSlice';
import { storeReviewsSlice } from '../screens/store-reviews-screen/storeReviewsSlice';
import { insightsSlice } from '../screens/insights-screen/insightsSlice';
import { storeProfileSlice } from '../screens/store-profile-screen/storeProfileSlice';
import { storeSettingsSlice } from '../screens/store-settings-screen/storeSettingsSlice';
import { paymentAccountsSlice } from '../screens/payment-accounts-screen/paymentAccountsSlice';
// Shopping (admin)
import { shopOverviewSlice } from '../screens/shop-overview-screen/shopOverviewSlice';
import { shopCategoriesSlice } from '../screens/shop-categories-screen/shopCategoriesSlice';
import { shopBannersSlice } from '../screens/shop-banners-screen/shopBannersSlice';
import { bannerFormSlice } from '../screens/banner-form-screen/bannerFormSlice';
import { shopReportsSlice } from '../screens/shop-reports-screen/shopReportsSlice';
import { orderLookupSlice } from '../screens/order-lookup-screen/orderLookupSlice';
import { shopStoresSlice } from '../screens/shop-stores-screen/shopStoresSlice';
// Food (vendor)
import { vendorSetupSlice } from '../screens/vendor-setup-screen/vendorSetupSlice';
import { vendorBrandSlice } from '../screens/vendor-brand-screen/vendorBrandSlice';
import { vendorSettingsSlice } from '../screens/vendor-settings-screen/vendorSettingsSlice';
import { vendorHoursSlice } from '../screens/vendor-hours-screen/vendorHoursSlice';
import { vendorZonesSlice } from '../screens/vendor-zones-screen/vendorZonesSlice';
import { vendorClosuresSlice } from '../screens/vendor-closures-screen/vendorClosuresSlice';
import { vendorPlanSlice } from '../screens/vendor-plan-screen/vendorPlanSlice';
import { vendorRidersSlice } from '../screens/vendor-riders-screen/vendorRidersSlice';
import { riderDetailSlice } from '../screens/rider-detail-screen/riderDetailSlice';
import { vendorMenuSlice } from '../screens/vendor-menu-screen/vendorMenuSlice';
import { vendorMenuItemSlice } from '../screens/vendor-menu-item-screen/vendorMenuItemSlice';
import { vendorCategoriesSlice } from '../screens/vendor-categories-screen/vendorCategoriesSlice';
import { vendorOptionGroupsSlice } from '../screens/vendor-option-groups-screen/vendorOptionGroupsSlice';
import { vendorOptionGroupSlice } from '../screens/vendor-option-group-screen/vendorOptionGroupSlice';
import { vendorTodaySlice } from '../screens/vendor-today-screen/vendorTodaySlice';
import { vendorWeeklyMenuSlice } from '../screens/vendor-weekly-menu-screen/vendorWeeklyMenuSlice';
import { vendorPreorderSlotsSlice } from '../screens/vendor-preorder-slots-screen/vendorPreorderSlotsSlice';
// Food (rider)
import { riderHomeSlice } from '../screens/rider-deliveries-screen/riderHomeSlice';
import { recipesAndCostsSlice } from '../screens/recipes-and-costs-screen/recipesAndCostsSlice';
import { recipeEditorSlice } from '../screens/recipe-editor-screen/recipeEditorSlice';
import { kitchenSettingsSlice } from '../screens/kitchen-settings-screen/kitchenSettingsSlice';
import { purchasesSlice } from '../screens/purchases-screen/purchasesSlice';
import { purchaseSlice } from '../screens/purchase-screen/purchaseSlice';
import { purchaseFormSlice } from '../screens/purchase-form-screen/purchaseFormSlice';
import { suppliersSlice } from '../screens/suppliers-screen/suppliersSlice';
import { priceWatchSlice } from '../screens/price-watch-screen/priceWatchSlice';
import { kitchenHubSlice } from '../screens/kitchen-hub-screen/kitchenHubSlice';
import { stockSlice } from '../screens/stock-screen/stockSlice';
import { stockTakeSlice } from '../screens/stock-take-screen/stockTakeSlice';
import { ingredientSlice } from '../screens/ingredient-screen/ingredientSlice';
import { ingredientFormSlice } from '../screens/ingredient-form-screen/ingredientFormSlice';
import { forecastAndPrepSlice } from '../screens/forecast-and-prep-screen/forecastAndPrepSlice';
import { wasteAndSurplusSlice } from '../screens/waste-and-surplus-screen/wasteAndSurplusSlice';
import { wasteFormSlice } from '../screens/waste-form-screen/wasteFormSlice';
import { boxFormSlice } from '../screens/box-form-screen/boxFormSlice';
import { boxSlice } from '../screens/box-screen/boxSlice';
import { donationsSlice } from '../screens/donations-screen/donationsSlice';
import { foodSurplusSlice } from '../screens/food-surplus-screen/foodSurplusSlice';
import { surplusReservedSlice } from '../screens/food-surplus-reserved-screen/surplusReservedSlice';
import { surplusReservationsSlice } from '../screens/food-surplus-reservations-screen/surplusReservationsSlice';
import { surplusListSlice } from '../screens/food-surplus-list-screen/surplusListSlice';
import { tiffinPlansSlice } from '../screens/tiffin-plans-screen/tiffinPlansSlice';
import { tiffinPlanFormSlice } from '../screens/tiffin-plan-form-screen/tiffinPlanFormSlice';
import { tiffinSubscribersSlice } from '../screens/tiffin-subscribers-screen/tiffinSubscribersSlice';
import { cateringSlice } from '../screens/catering-screen/cateringSlice';
import { cateringRequestSlice } from '../screens/catering-request-screen/cateringRequestSlice';
import { quoteBuilderSlice } from '../screens/quote-builder-screen/quoteBuilderSlice';
import { ramadanModeSlice } from '../screens/ramadan-mode-screen/ramadanModeSlice';
import { storefrontSlice } from '../screens/storefront-screen/storefrontSlice';
import { demandMapSlice } from '../screens/demand-map-screen/demandMapSlice';
import { menuInsightsSlice } from '../screens/menu-insights-screen/menuInsightsSlice';
import { menuExperimentSlice } from '../screens/menu-experiment-screen/menuExperimentSlice';
import { storyAndHygieneSlice } from '../screens/story-and-hygiene-screen/storyAndHygieneSlice';
import { publicStoreSlice } from '../screens/public-store-screen/publicStoreSlice';
import { assistantSlice } from '../screens/assistant-screen/assistantSlice';
import { aiDescriptionsSlice } from '../screens/ai-descriptions-screen/aiDescriptionsSlice';
import { aiSpecialsSlice } from '../screens/ai-specials-screen/aiSpecialsSlice';
import { aiCombosSlice } from '../screens/ai-combos-screen/aiCombosSlice';
import { aiPhotoCheckSlice } from '../screens/ai-photo-check-screen/aiPhotoCheckSlice';
import { reviewInsightsSlice } from '../screens/review-insights-screen/reviewInsightsSlice';
import { nutritionVendorSlice } from '../screens/nutrition-vendor-screen/nutritionVendorSlice';
import { pantrySlice } from '../screens/pantry-screen/pantrySlice';
import { recipeIdeasSlice } from '../screens/recipe-ideas-screen/recipeIdeasSlice';
import { homeRecipeSlice } from '../screens/home-recipe-screen/homeRecipeSlice';
import { missingItemsSlice } from '../screens/missing-items-screen/missingItemsSlice';
import { nutritionSettingsSlice } from '../screens/nutrition-settings-screen/nutritionSettingsSlice';
import { nutritionSummarySlice } from '../screens/nutrition-summary-screen/nutritionSummarySlice';
import { foodTiffinPlanSlice } from '../screens/food-tiffin-plan-screen/foodTiffinPlanSlice';
import { foodTiffinsSlice } from '../screens/food-tiffins-screen/foodTiffinsSlice';
import { foodTiffinSlice } from '../screens/food-tiffin-screen/foodTiffinSlice';
import { foodCateringFormSlice } from '../screens/food-catering-form-screen/foodCateringFormSlice';
import { foodCateringRequestsSlice } from '../screens/food-catering-requests-screen/foodCateringRequestsSlice';
import { foodCateringRequestSlice } from '../screens/food-catering-request-screen/foodCateringRequestSlice';

// `auth` is persisted through its OWN persistReducer so that exactly one
// field reaches disk. The session (user, business, tokens) is never
// persisted: tokens live in secure-store and the user is re-fetched from
// /auth/me by bootstrapSession on every cold start.
const authPersistConfig = {
  key: 'auth',
  storage: AsyncStorage,
  whitelist: ['hasSeenOnboarding'],
};

// Same pattern for the provider's pick: only `pending` reaches disk, so a new
// provider who restarts before PersonalInfo still has the type they chose.
const providerSelectionPersistConfig = {
  key: 'providerSelection',
  storage: AsyncStorage,
  whitelist: ['pending'],
};

const rootReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authReducer),
  preferences: preferencesSlice.reducer,
  appContainer: appContainerSlice.reducer,
  realtime: realtimeSlice.reducer,
  platformConfig: platformConfigSlice.reducer,
  voice: voiceSlice.reducer,
  designGallery: designGallerySlice.reducer,
  roleSelection: roleSelectionSlice.reducer,
  providerSelection: persistReducer(providerSelectionPersistConfig, providerSelectionSlice.reducer),
  signIn: signInSlice.reducer,
  signUp: signUpSlice.reducer,
  providerSignIn: providerSignInSlice.reducer,
  riderSignIn: riderSignInSlice.reducer,
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
  foodVendors: foodVendorsSlice.reducer,
  foodSearch: foodSearchSlice.reducer,
  foodVendor: foodVendorSlice.reducer,
  itemSheet: itemSheetSlice.reducer,
  foodBag: foodBagSlice.reducer,
  foodCheckout: foodCheckoutSlice.reducer,
  foodOrder: foodOrderSlice.reducer,
  foodFavourites: foodFavouritesSlice.reducer,
  foodRateOrder: foodRateOrderSlice.reducer,
  vendorReviews: vendorReviewsSlice.reducer,
  vendorInsights: vendorInsightsSlice.reducer,
  foodOverview: foodOverviewSlice.reducer,
  adminFoodVendors: adminFoodVendorsSlice.reducer,
  adminFoodVendor: adminFoodVendorSlice.reducer,
  adminFoodOrders: adminFoodOrdersSlice.reducer,
  adminFoodOrder: adminFoodOrderSlice.reducer,
  adminFoodReviews: adminFoodReviewsSlice.reducer,
  adminFoodCuisines: adminFoodCuisinesSlice.reducer,
  adminFoodBanners: adminFoodBannersSlice.reducer,
  adminFoodBannerForm: adminFoodBannerFormSlice.reducer,
  adminKitchenAi: adminKitchenAiSlice.reducer,
  adminKitchenPrices: adminKitchenPricesSlice.reducer,
  adminKitchenNutrition: adminKitchenNutritionSlice.reducer,
  adminKitchenAliases: adminKitchenAliasesSlice.reducer,
  adminKitchenCalendar: adminKitchenCalendarSlice.reducer,
  adminKitchenHygiene: adminKitchenHygieneSlice.reducer,
  adminKitchenSignatures: adminKitchenSignaturesSlice.reducer,
  adminKitchenDemand: adminKitchenDemandSlice.reducer,
  adminKitchenLookup: adminKitchenLookupSlice.reducer,
  vendorPromotions: vendorPromotionsSlice.reducer,
  vendorPromotion: vendorPromotionSlice.reducer,
  vendorBoard: vendorBoardSlice.reducer,
  vendorOrder: vendorOrderSlice.reducer,
  riderOrder: riderOrderSlice.reducer,
  riderCash: riderCashSlice.reducer,
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
  appointmentLookup: appointmentLookupSlice.reducer,
  reviewModeration: reviewModerationSlice.reducer,
  doctorVerification: doctorVerificationSlice.reducer,
  adminConditions: conditionsSlice.reducer,
  adminSpecialties: specialtiesSlice.reducer,
  healthOverview: healthOverviewSlice.reducer,
  doctorCalendar: doctorCalendarSlice.reducer,
  doctorInsights: doctorInsightsSlice.reducer,
  myReviews: myReviewsSlice.reducer,
  patientHistory: patientHistorySlice.reducer,
  doctorPatients: doctorPatientsSlice.reducer,
  prescriptionWriter: prescriptionWriterSlice.reducer,
  doctorAppointment: doctorAppointmentSlice.reducer,
  doctorToday: doctorTodaySlice.reducer,
  timeOff: timeOffSlice.reducer,
  availability: availabilitySlice.reducer,
  doctorProfileEdit: doctorProfileEditSlice.reducer,
  practiceSetup: practiceSetupSlice.reducer,
  video: videoSlice.reducer,
  postConsultReview: postConsultReviewSlice.reducer,
  symptomChecker: symptomCheckerSlice.reducer,
  recordUpload: recordUploadSlice.reducer,
  recordDetail: recordDetailSlice.reducer,
  healthRecords: healthRecordsSlice.reducer,
  prescriptionView: prescriptionViewSlice.reducer,
  doctorReviews: doctorReviewsSlice.reducer,
  bookAppointment: bookAppointmentSlice.reducer,
  familyMemberForm: familyMemberFormSlice.reducer,
  family: familySlice.reducer,
  doctorProfile: doctorProfileSlice.reducer,
  doctorList: doctorListSlice.reducer,
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
  // Food (vendor)
  vendorSetup: vendorSetupSlice.reducer,
  vendorBrand: vendorBrandSlice.reducer,
  vendorSettings: vendorSettingsSlice.reducer,
  vendorHours: vendorHoursSlice.reducer,
  vendorZones: vendorZonesSlice.reducer,
  vendorClosures: vendorClosuresSlice.reducer,
  vendorPlan: vendorPlanSlice.reducer,
  vendorRiders: vendorRidersSlice.reducer,
  riderDetail: riderDetailSlice.reducer,
  vendorMenu: vendorMenuSlice.reducer,
  vendorMenuItem: vendorMenuItemSlice.reducer,
  vendorCategories: vendorCategoriesSlice.reducer,
  vendorOptionGroups: vendorOptionGroupsSlice.reducer,
  vendorOptionGroup: vendorOptionGroupSlice.reducer,
  vendorToday: vendorTodaySlice.reducer,
  vendorWeeklyMenu: vendorWeeklyMenuSlice.reducer,
  vendorPreorderSlots: vendorPreorderSlotsSlice.reducer,
  // Food (rider)
  riderHome: riderHomeSlice.reducer,
  recipesAndCosts: recipesAndCostsSlice.reducer,
  recipeEditor: recipeEditorSlice.reducer,
  kitchenSettings: kitchenSettingsSlice.reducer,
  purchases: purchasesSlice.reducer,
  purchase: purchaseSlice.reducer,
  purchaseForm: purchaseFormSlice.reducer,
  suppliers: suppliersSlice.reducer,
  priceWatch: priceWatchSlice.reducer,
  kitchenHub: kitchenHubSlice.reducer,
  stock: stockSlice.reducer,
  stockTake: stockTakeSlice.reducer,
  ingredient: ingredientSlice.reducer,
  ingredientForm: ingredientFormSlice.reducer,
  forecastAndPrep: forecastAndPrepSlice.reducer,
  wasteAndSurplus: wasteAndSurplusSlice.reducer,
  wasteForm: wasteFormSlice.reducer,
  boxForm: boxFormSlice.reducer,
  kitchenBox: boxSlice.reducer,
  donations: donationsSlice.reducer,
  foodSurplus: foodSurplusSlice.reducer,
  surplusReserved: surplusReservedSlice.reducer,
  surplusReservations: surplusReservationsSlice.reducer,
  surplusList: surplusListSlice.reducer,
  tiffinPlans: tiffinPlansSlice.reducer,
  tiffinPlanForm: tiffinPlanFormSlice.reducer,
  tiffinSubscribers: tiffinSubscribersSlice.reducer,
  catering: cateringSlice.reducer,
  cateringRequest: cateringRequestSlice.reducer,
  quoteBuilder: quoteBuilderSlice.reducer,
  ramadanMode: ramadanModeSlice.reducer,
  storefront: storefrontSlice.reducer,
  demandMap: demandMapSlice.reducer,
  menuInsights: menuInsightsSlice.reducer,
  menuExperiment: menuExperimentSlice.reducer,
  storyAndHygiene: storyAndHygieneSlice.reducer,
  publicStore: publicStoreSlice.reducer,
  assistant: assistantSlice.reducer,
  aiDescriptions: aiDescriptionsSlice.reducer,
  aiSpecials: aiSpecialsSlice.reducer,
  aiCombos: aiCombosSlice.reducer,
  aiPhotoCheck: aiPhotoCheckSlice.reducer,
  reviewInsights: reviewInsightsSlice.reducer,
  nutritionVendor: nutritionVendorSlice.reducer,
  pantry: pantrySlice.reducer,
  recipeIdeas: recipeIdeasSlice.reducer,
  homeRecipe: homeRecipeSlice.reducer,
  missingItems: missingItemsSlice.reducer,
  nutritionSettings: nutritionSettingsSlice.reducer,
  nutritionSummary: nutritionSummarySlice.reducer,
  foodTiffinPlan: foodTiffinPlanSlice.reducer,
  foodTiffins: foodTiffinsSlice.reducer,
  foodTiffin: foodTiffinSlice.reducer,
  foodCateringForm: foodCateringFormSlice.reducer,
  foodCateringRequests: foodCateringRequestsSlice.reducer,
  foodCateringRequest: foodCateringRequestSlice.reducer,
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
//
// `platformConfig` describes the platform (GET /config), not the account: a
// sign-out must not forget that the platform is in maintenance.
// `providerSelection` is the same: it clears itself on reset.
const SHELL_SLICES = ['appContainer', 'preferences', 'auth', 'platformConfig', 'providerSelection'] as const;

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
