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
import { realtimeSlice } from './realtimeSlice';
import { platformConfigSlice } from './platformConfigSlice';

// ── App-level slices ──
import { appContainerSlice } from '../Components/app-container/appContainerSlice';
import { voiceSlice } from '../Components/voice/voiceSlice';

// ── Per-screen slices ──
// (register each screen's slice here — see CLAUDE.md "How to add a screen")
import { designGallerySlice } from '../screens/Dev/DesignGallery/designGallerySlice';
import { roleSelectionSlice } from '../screens/RoleSelection/roleSelectionSlice';
import { providerSelectionSlice } from '../screens/ProviderSelection/providerSelectionSlice';
import { signInSlice } from '../screens/Auth/SignIn/signInSlice';
import { signUpSlice } from '../screens/Auth/SignUp/signUpSlice';
import { providerSignInSlice } from '../screens/Auth/ProviderSignIn/providerSignInSlice';
import { riderSignInSlice } from '../screens/Auth/RiderSignIn/riderSignInSlice';
import { providerSignUpSlice } from '../screens/Auth/ProviderSignUp/providerSignUpSlice';
import { forgotPasswordSlice } from '../screens/Auth/ForgotPassword/forgotPasswordSlice';
import { resetPasswordOtpSlice } from '../screens/Auth/ResetPasswordOTP/resetPasswordOtpSlice';
import { resetPasswordSlice } from '../screens/Auth/ResetPassword/resetPasswordSlice';
import { emailVerificationSlice } from '../screens/Auth/EmailVerification/emailVerificationSlice';
import { verifySuccessSlice } from '../screens/Auth/VerifySuccess/verifySuccessSlice';
import { completeProfileSlice } from '../screens/Auth/CompleteProfile/completeProfileSlice';
import { personalInfoSlice } from '../screens/Partner/PersonalInfo/personalInfoSlice';
import { providerApprovalPendingSlice } from '../screens/Partner/ProviderApprovalPending/providerApprovalPendingSlice';
import { foodHomeSlice } from '../screens/Food/Customer/FoodHome/foodHomeSlice';
import { foodVendorsSlice } from '../screens/Food/Customer/FoodVendors/foodVendorsSlice';
import { foodSearchSlice } from '../screens/Food/Customer/FoodSearch/foodSearchSlice';
import { foodVendorSlice } from '../screens/Food/Customer/FoodVendor/foodVendorSlice';
import { itemSheetSlice } from '../screens/Food/Customer/FoodVendor/itemSheetSlice';
import { foodBagSlice } from '../screens/Food/Customer/FoodBag/foodBagSlice';
import { foodCheckoutSlice } from '../screens/Food/Customer/FoodCheckout/foodCheckoutSlice';
import { foodOrderSlice } from '../screens/Food/Customer/FoodOrder/foodOrderSlice';
import { foodFavouritesSlice } from '../screens/Food/Customer/FoodFavourites/foodFavouritesSlice';
import { foodRateOrderSlice } from '../screens/Food/Customer/FoodRateOrder/foodRateOrderSlice';
import { vendorReviewsSlice } from '../screens/Food/Vendor/VendorReviews/vendorReviewsSlice';
import { vendorInsightsSlice } from '../screens/Food/Vendor/VendorInsights/vendorInsightsSlice';
import { foodOverviewSlice } from '../screens/Admin/Food/FoodOverview/foodOverviewSlice';
import { adminFoodVendorsSlice } from '../screens/Admin/Food/AdminFoodVendors/adminFoodVendorsSlice';
import { adminFoodVendorSlice } from '../screens/Admin/Food/AdminFoodVendor/adminFoodVendorSlice';
import { adminFoodOrdersSlice } from '../screens/Admin/Food/AdminFoodOrders/adminFoodOrdersSlice';
import { adminFoodOrderSlice } from '../screens/Admin/Food/AdminFoodOrder/adminFoodOrderSlice';
import { adminFoodReviewsSlice } from '../screens/Admin/Food/AdminFoodReviews/adminFoodReviewsSlice';
import { adminFoodCuisinesSlice } from '../screens/Admin/Food/AdminFoodCuisines/adminFoodCuisinesSlice';
import { adminFoodBannersSlice } from '../screens/Admin/Food/AdminFoodBanners/adminFoodBannersSlice';
import { adminFoodBannerFormSlice } from '../screens/Admin/Food/AdminFoodBannerForm/adminFoodBannerFormSlice';
import { adminKitchenAiSlice } from '../screens/Admin/Kitchen/AdminKitchenAi/adminKitchenAiSlice';
import { adminKitchenPricesSlice } from '../screens/Admin/Kitchen/AdminKitchenPrices/adminKitchenPricesSlice';
import { adminKitchenNutritionSlice } from '../screens/Admin/Kitchen/AdminKitchenNutrition/adminKitchenNutritionSlice';
import { adminKitchenAliasesSlice } from '../screens/Admin/Kitchen/AdminKitchenAliases/adminKitchenAliasesSlice';
import { adminKitchenCalendarSlice } from '../screens/Admin/Kitchen/AdminKitchenCalendar/adminKitchenCalendarSlice';
import { adminKitchenHygieneSlice } from '../screens/Admin/Kitchen/AdminKitchenHygiene/adminKitchenHygieneSlice';
import { adminKitchenSignaturesSlice } from '../screens/Admin/Kitchen/AdminKitchenSignatures/adminKitchenSignaturesSlice';
import { adminKitchenDemandSlice } from '../screens/Admin/Kitchen/AdminKitchenDemand/adminKitchenDemandSlice';
import { adminKitchenLookupSlice } from '../screens/Admin/Kitchen/AdminKitchenLookup/adminKitchenLookupSlice';
import { vendorPromotionsSlice } from '../screens/Food/Vendor/VendorPromotions/vendorPromotionsSlice';
import { vendorPromotionSlice } from '../screens/Food/Vendor/VendorPromotion/vendorPromotionSlice';
import { vendorBoardSlice } from '../screens/Food/Vendor/VendorOrders/vendorBoardSlice';
import { vendorOrderSlice } from '../screens/Food/Vendor/VendorOrder/vendorOrderSlice';
import { riderOrderSlice } from '../screens/Food/Rider/RiderOrder/riderOrderSlice';
import { riderCashSlice } from '../screens/Food/Rider/RiderCash/riderCashSlice';
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
import { appointmentLookupSlice } from '../screens/Admin/Health/AppointmentLookup/appointmentLookupSlice';
import { reviewModerationSlice } from '../screens/Admin/Health/ReviewModeration/reviewModerationSlice';
import { doctorVerificationSlice } from '../screens/Admin/Health/DoctorVerification/doctorVerificationSlice';
import { conditionsSlice } from '../screens/Admin/Health/Conditions/conditionsSlice';
import { specialtiesSlice } from '../screens/Admin/Health/Specialties/specialtiesSlice';
import { healthOverviewSlice } from '../screens/Admin/Health/HealthOverview/healthOverviewSlice';
import { doctorCalendarSlice } from '../screens/Health/Doctor/DoctorCalendar/doctorCalendarSlice';
import { doctorInsightsSlice } from '../screens/Health/Doctor/DoctorInsights/doctorInsightsSlice';
import { myReviewsSlice } from '../screens/Health/Doctor/MyReviews/myReviewsSlice';
import { patientHistorySlice } from '../screens/Health/Doctor/PatientHistory/patientHistorySlice';
import { doctorPatientsSlice } from '../screens/Health/Doctor/DoctorPatients/doctorPatientsSlice';
import { prescriptionWriterSlice } from '../screens/Health/Doctor/PrescriptionWriter/prescriptionWriterSlice';
import { doctorAppointmentSlice } from '../screens/Health/Doctor/DoctorAppointment/doctorAppointmentSlice';
import { doctorTodaySlice } from '../screens/Health/Doctor/DoctorToday/doctorTodaySlice';
import { timeOffSlice } from '../screens/Health/Doctor/TimeOff/timeOffSlice';
import { availabilitySlice } from '../screens/Health/Doctor/Availability/availabilitySlice';
import { doctorProfileEditSlice } from '../screens/Health/Doctor/DoctorProfileEdit/doctorProfileEditSlice';
import { practiceSetupSlice } from '../screens/Health/Doctor/PracticeSetup/practiceSetupSlice';
import { videoSlice } from '../screens/Health/Patient/VideoPrecheck/videoSlice';
import { postConsultReviewSlice } from '../screens/Health/Patient/PostConsultReview/postConsultReviewSlice';
import { symptomCheckerSlice } from '../screens/Health/Patient/SymptomChecker/symptomCheckerSlice';
import { recordUploadSlice } from '../screens/Health/Patient/RecordUpload/recordUploadSlice';
import { recordDetailSlice } from '../screens/Health/Patient/RecordDetail/recordDetailSlice';
import { healthRecordsSlice } from '../screens/Health/Patient/HealthRecords/healthRecordsSlice';
import { prescriptionViewSlice } from '../screens/Health/Patient/PrescriptionView/prescriptionViewSlice';
import { doctorReviewsSlice } from '../screens/Health/Patient/DoctorReviews/doctorReviewsSlice';
import { bookAppointmentSlice } from '../screens/Health/Patient/BookAppointment/bookAppointmentSlice';
import { familyMemberFormSlice } from '../screens/Health/Patient/FamilyMemberForm/familyMemberFormSlice';
import { familySlice } from '../screens/Health/Patient/FamilyMembers/familySlice';
import { doctorProfileSlice } from '../screens/Health/Patient/DoctorProfile/doctorProfileSlice';
import { doctorListSlice } from '../screens/Health/Patient/DoctorList/doctorListSlice';
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
// Food (vendor)
import { vendorSetupSlice } from '../screens/Food/Vendor/VendorSetup/vendorSetupSlice';
import { vendorBrandSlice } from '../screens/Food/Vendor/VendorBrand/vendorBrandSlice';
import { vendorSettingsSlice } from '../screens/Food/Vendor/VendorSettings/vendorSettingsSlice';
import { vendorHoursSlice } from '../screens/Food/Vendor/VendorHours/vendorHoursSlice';
import { vendorZonesSlice } from '../screens/Food/Vendor/VendorZones/vendorZonesSlice';
import { vendorClosuresSlice } from '../screens/Food/Vendor/VendorClosures/vendorClosuresSlice';
import { vendorPlanSlice } from '../screens/Food/Vendor/VendorPlan/vendorPlanSlice';
import { vendorRidersSlice } from '../screens/Food/Vendor/VendorRiders/vendorRidersSlice';
import { riderDetailSlice } from '../screens/Food/Vendor/RiderDetail/riderDetailSlice';
import { vendorMenuSlice } from '../screens/Food/Vendor/VendorMenu/vendorMenuSlice';
import { vendorMenuItemSlice } from '../screens/Food/Vendor/VendorMenuItem/vendorMenuItemSlice';
import { vendorCategoriesSlice } from '../screens/Food/Vendor/VendorCategories/vendorCategoriesSlice';
import { vendorOptionGroupsSlice } from '../screens/Food/Vendor/VendorOptionGroups/vendorOptionGroupsSlice';
import { vendorOptionGroupSlice } from '../screens/Food/Vendor/VendorOptionGroup/vendorOptionGroupSlice';
import { vendorTodaySlice } from '../screens/Food/Vendor/VendorToday/vendorTodaySlice';
import { vendorWeeklyMenuSlice } from '../screens/Food/Vendor/VendorWeeklyMenu/vendorWeeklyMenuSlice';
import { vendorPreorderSlotsSlice } from '../screens/Food/Vendor/VendorPreorderSlots/vendorPreorderSlotsSlice';
// Food (rider)
import { riderHomeSlice } from '../screens/Food/Rider/RiderDeliveries/riderHomeSlice';
import { recipesAndCostsSlice } from '../screens/Food/Kitchen/RecipesAndCosts/recipesAndCostsSlice';
import { recipeEditorSlice } from '../screens/Food/Kitchen/RecipeEditor/recipeEditorSlice';
import { kitchenSettingsSlice } from '../screens/Food/Kitchen/KitchenSettings/kitchenSettingsSlice';
import { purchasesSlice } from '../screens/Food/Kitchen/Purchases/purchasesSlice';
import { purchaseSlice } from '../screens/Food/Kitchen/Purchase/purchaseSlice';
import { purchaseFormSlice } from '../screens/Food/Kitchen/PurchaseForm/purchaseFormSlice';
import { suppliersSlice } from '../screens/Food/Kitchen/Suppliers/suppliersSlice';
import { priceWatchSlice } from '../screens/Food/Kitchen/PriceWatch/priceWatchSlice';
import { kitchenHubSlice } from '../screens/Food/Kitchen/KitchenHub/kitchenHubSlice';
import { stockSlice } from '../screens/Food/Kitchen/Stock/stockSlice';
import { stockTakeSlice } from '../screens/Food/Kitchen/StockTake/stockTakeSlice';
import { ingredientSlice } from '../screens/Food/Kitchen/Ingredient/ingredientSlice';
import { ingredientFormSlice } from '../screens/Food/Kitchen/IngredientForm/ingredientFormSlice';
import { forecastAndPrepSlice } from '../screens/Food/Kitchen/ForecastAndPrep/forecastAndPrepSlice';
import { wasteAndSurplusSlice } from '../screens/Food/Kitchen/WasteAndSurplus/wasteAndSurplusSlice';
import { wasteFormSlice } from '../screens/Food/Kitchen/WasteForm/wasteFormSlice';
import { boxFormSlice } from '../screens/Food/Kitchen/BoxForm/boxFormSlice';
import { boxSlice } from '../screens/Food/Kitchen/Box/boxSlice';
import { donationsSlice } from '../screens/Food/Kitchen/Donations/donationsSlice';
import { foodSurplusSlice } from '../screens/Food/Customer/FoodSurplus/foodSurplusSlice';
import { surplusReservedSlice } from '../screens/Food/Customer/FoodSurplusReserved/surplusReservedSlice';
import { surplusReservationsSlice } from '../screens/Food/Customer/FoodSurplusReservations/surplusReservationsSlice';
import { surplusListSlice } from '../screens/Food/Customer/FoodSurplusList/surplusListSlice';
import { tiffinPlansSlice } from '../screens/Food/Growth/TiffinPlans/tiffinPlansSlice';
import { tiffinPlanFormSlice } from '../screens/Food/Growth/TiffinPlanForm/tiffinPlanFormSlice';
import { tiffinSubscribersSlice } from '../screens/Food/Growth/TiffinSubscribers/tiffinSubscribersSlice';
import { cateringSlice } from '../screens/Food/Growth/Catering/cateringSlice';
import { cateringRequestSlice } from '../screens/Food/Growth/CateringRequest/cateringRequestSlice';
import { quoteBuilderSlice } from '../screens/Food/Growth/QuoteBuilder/quoteBuilderSlice';
import { ramadanModeSlice } from '../screens/Food/Growth/RamadanMode/ramadanModeSlice';
import { storefrontSlice } from '../screens/Food/Growth/Storefront/storefrontSlice';
import { demandMapSlice } from '../screens/Food/Growth/DemandMap/demandMapSlice';
import { menuInsightsSlice } from '../screens/Food/Growth/MenuInsights/menuInsightsSlice';
import { menuExperimentSlice } from '../screens/Food/Growth/MenuExperiment/menuExperimentSlice';
import { storyAndHygieneSlice } from '../screens/Food/Growth/StoryAndHygiene/storyAndHygieneSlice';
import { publicStoreSlice } from '../screens/Food/Customer/PublicStore/publicStoreSlice';
import { assistantSlice } from '../screens/Food/Kitchen/Assistant/assistantSlice';
import { aiDescriptionsSlice } from '../screens/Food/Kitchen/AiDescriptions/aiDescriptionsSlice';
import { aiSpecialsSlice } from '../screens/Food/Kitchen/AiSpecials/aiSpecialsSlice';
import { aiCombosSlice } from '../screens/Food/Kitchen/AiCombos/aiCombosSlice';
import { aiPhotoCheckSlice } from '../screens/Food/Kitchen/AiPhotoCheck/aiPhotoCheckSlice';
import { reviewInsightsSlice } from '../screens/Food/Kitchen/ReviewInsights/reviewInsightsSlice';
import { nutritionVendorSlice } from '../screens/Food/Kitchen/NutritionVendor/nutritionVendorSlice';
import { pantrySlice } from '../screens/MyKitchen/Pantry/pantrySlice';
import { recipeIdeasSlice } from '../screens/MyKitchen/RecipeIdeas/recipeIdeasSlice';
import { homeRecipeSlice } from '../screens/MyKitchen/HomeRecipe/homeRecipeSlice';
import { missingItemsSlice } from '../screens/MyKitchen/MissingItems/missingItemsSlice';
import { nutritionSettingsSlice } from '../screens/MyKitchen/NutritionSettings/nutritionSettingsSlice';
import { nutritionSummarySlice } from '../screens/MyKitchen/NutritionSummary/nutritionSummarySlice';
import { foodTiffinPlanSlice } from '../screens/Food/Customer/FoodTiffinPlan/foodTiffinPlanSlice';
import { foodTiffinsSlice } from '../screens/Food/Customer/FoodTiffins/foodTiffinsSlice';
import { foodTiffinSlice } from '../screens/Food/Customer/FoodTiffin/foodTiffinSlice';
import { foodCateringFormSlice } from '../screens/Food/Customer/FoodCateringForm/foodCateringFormSlice';
import { foodCateringRequestsSlice } from '../screens/Food/Customer/FoodCateringRequests/foodCateringRequestsSlice';
import { foodCateringRequestSlice } from '../screens/Food/Customer/FoodCateringRequest/foodCateringRequestSlice';

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
