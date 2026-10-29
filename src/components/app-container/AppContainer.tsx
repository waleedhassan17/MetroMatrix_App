// ═══════════════════════════════════════════════════════
// MetroMatrix — Root AppContainer
// ═══════════════════════════════════════════════════════
// Top-level app shell rendered inside Provider/PersistGate/ThemeProvider.
// Owns: session bootstrap (fetch-me), the renderNavigator() role switch, the
// navigation container + deep linking, the status bar, the native-splash
// release, the push pre-prompt, and toast notifications.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Linking, View, StyleSheet, StatusBar } from 'react-native';
import { NavigationContainer, getStateFromPath, type LinkingOptions } from '@react-navigation/native';
import * as NativeSplash from 'expo-splash-screen';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { navigationTheme, useStyles, useTheme, type Theme } from '../../theme';
import { toastConfig } from '../../Custom-Components/toastConfig';

import BaseNavigator from '../../navigators/BaseNavigator';
import CustomerNavigator from '../../navigators/CustomerNavigator';
import StorePartnerNavigator from '../../navigators/StorePartnerNavigator';
import DoctorPartnerNavigator from '../../navigators/DoctorPartnerNavigator';
import KitchenPartnerNavigator from '../../navigators/KitchenPartnerNavigator';
import RiderNavigator from '../../navigators/RiderNavigator';
import AdminNavigator from '../../navigators/AdminNavigator';
import { resolveGate, isGateCleared } from '../../navigators/sessionGate';

import {
  bootstrapSession,
  refreshSession,
  selectIsAppReady,
  selectNetworkIsDown,
} from './appContainerSlice';
import { OfflineGate } from './OfflineGate';
import { MaintenanceGate } from './MaintenanceGate';
import {
  loadPlatformConfig,
  maintenanceReported,
  selectMaintenance,
  servicePausedReported,
  signupsPausedReported,
} from '../../store/platformConfigSlice';
import { PushPrePrompt } from './PushPrePrompt';
import { onPushTap, pushTapUrl } from '../../services/push';
import { signOut } from '../../screens/Auth/authSlice';
import { SplashScreen } from '../../screens/Onboarding/Splash/SplashScreen';
import { resetAllState } from '../../store/resetAllState';
import {
  setSessionExpiredHandler,
  setBusinessStatusStaleHandler,
  setPlatformNoticeHandler,
} from '../../utils/authEvents';
import { realtime } from '../../services/realtime/socketClient';
import { setRealtimeStatus } from '../../store/realtimeSlice';
import { useOrientationPolicy } from '../../hooks/useLayoutClass';

// ─── Deep linking ─────────────────────────────────────
// metromatrix://verify-success?token=…        → VerifySuccess (the email link)
// metromatrix://reset-password?email=…        → ResetPasswordOTP
// metromatrix://shop/store/:slug, shop/product/:id → a store, a product
// metromatrix://orders/:groupCode               → an order
// The same config gives the web build readable paths. Each root navigator
// owns different routes; a path only resolves while its navigator is mounted.
/** `customer`: a customer is signed in (a kitchen's link then opens its Food page). */
const linkingFor = (customer: boolean): LinkingOptions<ReactNavigation.RootParamList> => ({
  prefixes: ['metromatrix://'],
  // A kitchen's own link or QR (/s/:slug): signed out it is PublicStore; a
  // signed-in customer gets the kitchen's page in the Food app, marked `via`
  // so the order counts as one the kitchen brought. (One route name per
  // path: the same screen in two stacks breaks the swap after sign-in.)
  getStateFromPath: (path, options) => {
    const m = /^\/?s\/([^/?#]+)\/?(?:\?(.*))?$/.exec(path);
    if (m && customer) {
      const via = /(^|&)via=qr(&|$)/.test(m[2] ?? '') ? 'qr' : 'link';
      return getStateFromPath(`food/vendor/${m[1]}?via=${via}`, options);
    }
    return getStateFromPath(path, options);
  },
  config: {
    screens: {
      // No screen claims '/': the gate's first route (Onboarding on a fresh
      // install, Role Selection after) must win, as it does on native.
      Onboarding: 'intro',
      RoleSelection: 'get-started',
      ProviderSelection: 'provider/choose-service',
      SignIn: 'sign-in',
      SignUp: 'sign-up',
      ProviderSignIn: 'provider/sign-in',
      RiderSignIn: 'rider/sign-in',
      // A kitchen's own link or QR (signed out: its public page; signed in: its Food page).
      PublicStore: 's/:slug',
      ProviderSignUp: 'provider/sign-up',
      ForgotPassword: 'forgot-password',
      ResetPasswordOTP: 'reset-password',
      ResetPassword: 'reset-password/new',
      EmailVerification: 'verify-email',
      VerifySuccess: 'verify-success',
      CompleteProfile: 'complete-profile',
      PersonalInfo: 'provider/personal-info',
      ProviderApprovalPending: 'provider/pending',
      Rejected: 'provider/changes-needed',
      Suspended: 'provider/paused',
      AdminTotp: 'staff/verify',
      AdminTwoFactorEnrol: 'staff/authenticator',
      DesignGallery: 'dev/gallery',
      // The store partner's app (its own stack): metromatrix://store/orders/:id
      StoreOrderDetail: 'store/orders/:id',
      StoreReturnDetail: 'store/returns/:id',
      ProductForm: 'store/products/edit',
      Inventory: 'store/inventory',
      Insights: 'store/insights',
      // The doctor's app (its own stack): metromatrix://doctor/appointments/:id
      DoctorAppointment: 'doctor/appointments/:id',
      PrescriptionWriter: 'doctor/appointments/:appointmentId/prescription',
      PracticeSetup: 'doctor/setup',
      Availability: 'doctor/availability',
      TimeOff: 'doctor/time-off',
      PatientHistory: 'doctor/patients/:id',
      MyReviews: 'doctor/reviews',
      DoctorInsights: 'doctor/insights',
      DoctorProfileEdit: 'doctor/profile',
      // The Food vendor's app (its own stack): metromatrix://vendor/orders
      VendorTabs: {
        screens: { TodayTab: 'vendor/today', OrdersTab: 'vendor/orders', MenuTab: 'vendor/menu', KitchenTab: 'vendor/kitchen', RidersTab: 'vendor/riders', MoreTab: 'vendor/more' },
      },
      VendorSetup: 'vendor/setup',
      VendorBrand: 'vendor/brand',
      VendorSettings: 'vendor/settings',
      VendorHours: 'vendor/hours',
      VendorZones: 'vendor/zones',
      VendorClosures: 'vendor/closures',
      VendorPlan: 'vendor/plan',
      VendorRiderDetail: 'vendor/riders/:id',
      VendorMenuItem: 'vendor/menu/dish/:id?',
      VendorCategories: 'vendor/menu/categories',
      VendorOptionGroups: 'vendor/menu/add-ons',
      VendorOptionGroup: 'vendor/menu/add-on/:id?',
      VendorWeeklyMenu: 'vendor/weekly-menu',
      VendorPreorderSlots: 'vendor/preorder-slots',
      VendorPromotions: 'vendor/deals',
      VendorPromotion: 'vendor/deal/:id?',
      VendorOrder: 'vendor/orders/:id',
      VendorReviews: 'vendor/reviews',
      VendorInsights: 'vendor/insights',
      VendorMenuPage: 'vendor/my-menu',
      VendorRidersPage: 'vendor/my-riders',
      KitchenStock: 'vendor/kitchen/stock',
      KitchenStockTake: 'vendor/kitchen/stock/count',
      KitchenIngredient: 'vendor/kitchen/stock/:id',
      KitchenIngredientForm: 'vendor/kitchen/ingredient/:id?',
      KitchenRecipes: 'vendor/kitchen/recipes',
      KitchenRecipe: 'vendor/kitchen/recipes/:itemId',
      KitchenSettings: 'vendor/kitchen/settings',
      KitchenPurchases: 'vendor/kitchen/purchases',
      KitchenPurchaseForm: 'vendor/kitchen/purchases/new',
      KitchenPurchase: 'vendor/kitchen/purchases/:id',
      KitchenSuppliers: 'vendor/kitchen/suppliers',
      KitchenPriceWatch: 'vendor/kitchen/prices',
      KitchenForecast: 'vendor/kitchen/forecast',
      KitchenWaste: 'vendor/kitchen/waste',
      KitchenWasteForm: 'vendor/kitchen/waste/new',
      KitchenBoxForm: 'vendor/kitchen/bachat-box/new',
      KitchenBox: 'vendor/kitchen/bachat-box/:id',
      KitchenDonations: 'vendor/kitchen/donations',
      GrowthTiffin: 'vendor/tiffin',
      GrowthTiffinPlanForm: 'vendor/tiffin/plan/:id?',
      GrowthTiffinSubscribers: 'vendor/tiffin/subscribers',
      GrowthCatering: 'vendor/catering',
      GrowthCateringRequest: 'vendor/catering/:code',
      GrowthQuote: 'vendor/catering/:code/quote',
      GrowthRamadan: 'vendor/ramadan',
      GrowthStorefront: 'vendor/storefront',
      GrowthDemand: 'vendor/demand',
      GrowthMenuInsights: 'vendor/menu-insights',
      GrowthExperiment: 'vendor/menu-insights/tests/:id',
      GrowthStory: 'vendor/story',
      KitchenAssistant: 'vendor/assistant',
      KitchenAiDescriptions: 'vendor/assistant/descriptions',
      KitchenAiSpecials: 'vendor/assistant/specials',
      KitchenAiCombos: 'vendor/assistant/combos',
      KitchenAiPhotoCheck: 'vendor/assistant/photo',
      KitchenReviewInsights: 'vendor/reviews/themes',
      KitchenReviewTheme: 'vendor/reviews/themes/:theme',
      KitchenNutrition: 'vendor/nutrition',
      // The rider's app: metromatrix://rider/deliveries
      RiderTabs: {
        screens: { DeliveriesTab: 'rider/deliveries', CashTab: 'rider/cash', RiderProfileTab: 'rider/profile' },
      },
      RiderOrder: 'rider/deliveries/:id',
      // ── The customer app (the FYP's): the home and its pages on the root
      // stack; each service its own app with its own tabs. Every service app
      // has its tabs under a deep link (initialRouteName), so back from a
      // linked doctor, order or record lands on that service's tabs.
      CustomerHome: 'home',
      ServicePreview: 'home/services/:service',
      Orders: 'orders',
      Profile: 'profile',
      ChangePassword: 'profile/password',
      AddressBook: 'profile/addresses',
      AddressForm: 'profile/addresses/edit',
      Notifications: 'profile/notifications',
      RealtimeCheck: 'dev/realtime',
      // Health: /health, metromatrix://health/doctor/:id,
      // metromatrix://health/appointment/:code (push taps too) …
      HealthApp: {
        initialRouteName: 'HealthTabs',
        screens: {
          HealthTabs: {
            initialRouteName: 'HealthHomeTab',
            screens: {
              HealthHomeTab: 'health',
              AppointmentsTab: 'health/appointments',
              RecordsTab: 'profile/records',
              HealthProfileTab: 'health/profile',
            },
          },
          HealthSearch: 'health/search',
          SpecialtyList: 'health/specialties',
          ConditionList: 'health/conditions',
          DoctorList: { path: 'health/doctors', alias: ['health/specialty/:specialty'] },
          DoctorProfile: 'health/doctor/:id',
          DoctorReviews: 'health/doctor/:doctorId/reviews',
          BookingConfirmed: 'health/booked/:code',
          AppointmentDetail: 'health/appointment/:code',
          VideoPrecheck: 'health/appointment/:code/video',
          PostConsultReview: 'health/appointment/:code/rate',
          PaymentProof: 'health/appointment/:appointmentCode/pay',
          PrescriptionList: 'profile/prescriptions',
          PrescriptionView: 'profile/prescriptions/:id',
          RecordUpload: 'profile/records/new',
          RecordDetail: 'profile/records/:id',
          FamilyMembers: 'profile/family',
          FamilyMemberForm: 'profile/family/edit',
          SymptomChecker: 'health/symptoms',
          SymptomResult: 'health/symptoms/result',
          Emergency: 'health/emergency',
        },
      },
      // Shopping: /shop, /shop/store/:slug, /shop/product/:id;
      // metromatrix://orders/MM-24A7Q2 → that order (push taps too)
      ShopApp: {
        initialRouteName: 'ShopTabs',
        screens: {
          ShopTabs: {
            initialRouteName: 'ShopHomeTab',
            screens: {
              ShopHomeTab: 'shop',
              BagTab: 'shop/bag',
              SavedTab: 'profile/saved',
              ShopOrdersTab: 'shop/orders',
            },
          },
          CategoryBrowse: 'shop/categories',
          StoreList: 'shop/stores',
          ShopSearch: 'shop/search',
          StorePage: 'shop/store/:slug',
          ProductList: 'shop/products',
          ProductDetail: 'shop/product/:id',
          ProductReviews: 'shop/product/:productId/reviews',
          Checkout: 'shop/checkout',
          OrderPlaced: 'shop/placed/:groupCode',
          OrderDetail: 'orders/:groupCode',
          PaymentProof: 'orders/:groupCode/pay/:orderId',
          ReturnRequest: 'orders/:groupCode/return/:orderId',
          WriteReview: 'orders/:groupCode/review/:orderId/:itemId',
        },
      },
      // Food Court: /home/food (its Home tab)
      FoodApp: {
        initialRouteName: 'FoodTabs',
        screens: {
          FoodTabs: {
            initialRouteName: 'FoodHomeTab',
            screens: { FoodHomeTab: 'home/food', FoodOrdersTab: 'food/orders', FoodProfileTab: 'food/profile' },
          },
          FoodVendors: 'food/restaurants',
          FoodSearch: 'food/search',
          FoodVendor: 'food/vendor/:slug',
          FoodBag: 'food/bag',
          FoodCheckout: 'food/checkout',
          FoodOrderPlaced: 'food/placed/:code',
          FoodOrder: 'food/order/:code',
          FoodFavourites: 'food/saved',
          PaymentProof: 'food/order/:foodOrderCode/pay',
          FoodRateOrder: 'food/order/:code/rate',
          FoodReviews: 'food/reviews/:id',
          FoodSurplusList: 'food/bachat-box',
          FoodSurplusReservations: 'food/bachat-box/reservations',
          FoodSurplusReserved: 'food/bachat-box/reservations/:code',
          FoodSurplus: 'food/bachat-box/:id',
          FoodTiffins: 'food/tiffins',
          FoodTiffin: 'food/tiffins/:code',
          FoodTiffinPlan: 'food/tiffin/:id',
          FoodCateringRequests: 'food/dawat',
          FoodCateringRequest: 'food/dawat/:code',
          FoodCateringForm: 'food/vendor/:slug/dawat',
          // My Kitchen (a pantry reminder's tap: metromatrix://mykitchen/pantry)
          MyKitchen: { path: 'food/my-kitchen', alias: ['mykitchen/pantry'] },
          MyKitchenRecipes: 'food/my-kitchen/recipes',
          MyKitchenRecipe: 'food/my-kitchen/recipes/:id',
          MyKitchenMissing: 'food/my-kitchen/recipes/:id/missing',
          NutritionSettings: 'food/nutrition',
          NutritionSummary: 'food/nutrition/week',
        },
      },
      ApprovalsTab: {
        initialRouteName: 'ApprovalQueue',
        screens: { ApprovalQueue: 'approvals', BusinessReview: 'approvals/:id' },
      },
      ShopAdminTab: {
        initialRouteName: 'ShopOverview',
        screens: {
          ShopOverview: 'admin/shop',
          ShopReports: 'admin/shop/reports',
          ShopCategories: 'admin/shop/categories',
          ShopBanners: 'admin/shop/banners',
          BannerForm: 'admin/shop/banners/edit',
          ShopStores: 'admin/shop/stores',
          OrderLookup: 'admin/shop/orders',
        },
      },
      HealthAdminTab: {
        initialRouteName: 'HealthOverview',
        screens: {
          HealthOverview: 'admin/health',
          Specialties: 'admin/health/specialties',
          Conditions: 'admin/health/conditions',
          DoctorVerification: 'admin/health/doctors',
          ReviewModeration: 'admin/health/reviews',
          AppointmentLookup: 'admin/health/appointments',
        },
      },
      FoodAdminTab: {
        initialRouteName: 'FoodOverview',
        screens: {
          FoodOverview: 'admin/food',
          AdminFoodVendors: 'admin/food/vendors',
          AdminFoodVendor: 'admin/food/vendors/:id',
          AdminFoodOrders: 'admin/food/orders',
          AdminFoodOrder: 'admin/food/orders/:id',
          AdminFoodReviews: 'admin/food/reviews',
          AdminFoodCuisines: 'admin/food/cuisines',
          AdminFoodBanners: 'admin/food/banners',
          AdminFoodBannerForm: 'admin/food/banners/edit',
          AdminKitchenAi: 'admin/food/kitchen/assistant',
          AdminKitchenPrices: 'admin/food/kitchen/prices',
          AdminKitchenNutrition: 'admin/food/kitchen/nutrition',
          AdminKitchenAliases: 'admin/food/kitchen/words',
          AdminKitchenCalendar: 'admin/food/kitchen/calendar',
          AdminKitchenHygiene: 'admin/food/kitchen/hygiene',
          AdminKitchenHygieneReview: 'admin/food/kitchen/hygiene/:businessId',
          AdminKitchenSignatures: 'admin/food/kitchen/signatures',
          AdminKitchenDemand: 'admin/food/kitchen/demand',
          AdminKitchenLookup: 'admin/food/kitchen/lookup',
        },
      },
      // Staff's Profile tab (the customer's Profile lives at /profile).
      ProfileTab: {
        path: 'account',
        initialRouteName: 'Profile',
        screens: { Profile: '', ChangePassword: 'password', Notifications: 'notifications' },
      },
    },
  } as LinkingOptions<ReactNavigation.RootParamList>['config'],
});

export const AppContainer: React.FC = () => {
  const dispatch = useAppDispatch();
  const isAppReady = useAppSelector(selectIsAppReady);
  const networkIsDown = useAppSelector(selectNetworkIsDown);
  const maintenance = useAppSelector(selectMaintenance);
  const auth = useAppSelector(state => state.auth);
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const gate = resolveGate(auth);
  const customer = gate === 'customer';
  const linking = useMemo(() => linkingFor(customer), [customer]);

  // ─── Session restore on cold start: stored token → GET /auth/me refreshes
  // the user and the app opens on their view; missing/invalid token →
  // Role Selection. Sets isAppReady when done.
  useEffect(() => {
    dispatch(bootstrapSession());
    // The platform's switches (GET /config): sign-ups, services, maintenance.
    // Best effort and in parallel: the server enforces them either way.
    dispatch(loadPlatformConfig());
  }, [dispatch]);

  // ─── Platform-notice bridge: a request refused because of a switch flipped
  // after boot (maintenance, a paused service, paused sign-ups) is recorded
  // so the matching screen shows at once.
  useEffect(() => {
    setPlatformNoticeHandler(notice => {
      if (notice.kind === 'maintenance') dispatch(maintenanceReported({ message: notice.message }));
      else if (notice.kind === 'service_paused') dispatch(servicePausedReported({ service: notice.service }));
      else dispatch(signupsPausedReported({ role: notice.role }));
    });
    return () => setPlatformNoticeHandler(null);
  }, [dispatch]);

  // ─── Splash: the native splash is held from App.tsx until the JS splash
  // has painted the same mark in the same place, then released — native → JS
  // reads as one moment. The JS splash plays every launch and stays up until
  // BOTH its animation and bootstrapSession are done, so it can never lift
  // onto a stale route; then it fades out over the right navigator.
  const [splashPlayed, setSplashPlayed] = useState(false);
  const [splashGone, setSplashGone] = useState(false);
  const [splashOpacity] = useState(() => new Animated.Value(1));
  const releaseNativeSplash = useCallback(() => {
    void NativeSplash.hideAsync().catch(() => {
      /* already hidden (fast refresh) */
    });
  }, []);
  const onSplashPlayed = useCallback(() => setSplashPlayed(true), []);

  useEffect(() => {
    if (!splashPlayed || !isAppReady) return;
    const fade = Animated.timing(splashOpacity, {
      toValue: 0,
      duration: theme.motion.sheet.duration,
      useNativeDriver: true,
    });
    fade.start(() => setSplashGone(true));
    return () => fade.stop();
  }, [splashPlayed, isAppReady, splashOpacity, theme.motion.sheet.duration]);

  // ─── Session-expired bridge: when the axios 401-refresh flow gives up it
  // has already cleared the stored tokens; this resets the store so the
  // navigator switches back to Role Selection instead of leaving the user on
  // authenticated screens whose every request fails.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      dispatch(resetAllState());
      dispatch(signOut());
      Toast.show({ type: 'info', text1: 'Session expired', text2: 'Please sign in again.' });
    });
    return () => setSessionExpiredHandler(null);
  }, [dispatch]);

  // ─── Business-status-stale bridge: a partner request 403'd with
  // BUSINESS_SUSPENDED. Re-read /auth/me — the fresh business status makes
  // the gate route to Suspended. Debounced: a screen firing several requests
  // at once must trigger one refresh.
  const statusRefreshAt = useRef(0);
  useEffect(() => {
    setBusinessStatusStaleHandler(() => {
      const now = Date.now();
      if (now - statusRefreshAt.current < 5000) return;
      statusRefreshAt.current = now;
      dispatch(refreshSession());
    });
    return () => setBusinessStatusStaleHandler(null);
  }, [dispatch]);

  // ─── Phones stay in portrait; tablets may turn (the vendor board's columns).
  useOrientationPolicy();

  // ─── The live connection (Food): its state feeds realtimeSlice, and it
  // closes with the session — screens open it through hooks/useRealtime.
  useEffect(
    () => realtime.onStatus(status => dispatch(setRealtimeStatus({ status, at: new Date().toISOString() }))),
    [dispatch],
  );
  useEffect(() => {
    if (!auth.isAuthenticated) realtime.stop();
  }, [auth.isAuthenticated]);

  // ─── Push taps: open what the push is about (an order, a return, a
  // delivery), through the app's own deep links, once the role's app is mounted.
  useEffect(() => {
    if (gate !== 'customer' && gate !== 'partner' && gate !== 'rider') return;
    return onPushTap(data => {
      const url = pushTapUrl(data, gate);
      if (url) void Linking.openURL(url);
    });
  }, [gate]);

  // ─── Which top-level navigator mounts. Every gated state is a branch inside
  // BaseNavigator; a cleared gate mounts the role's app. Keys make a swap
  // remount, so back-navigation can never cross from one app into another.
  const renderNavigator = () => {
    switch (gate) {
      case 'customer':
        return <CustomerNavigator key="customer" />;
      case 'partner':
        // Approved partner: the app for the business's service.
        switch (auth.business?.serviceType) {
          case 'healthcare':
            return <DoctorPartnerNavigator key="partner-doctor" />;
          case 'food':
            return <KitchenPartnerNavigator key="partner-kitchen" />;
          default:
            return <StorePartnerNavigator key="partner-store" />;
        }
      case 'rider':
        return <RiderNavigator key="rider" />;
      case 'admin':
        return <AdminNavigator key="admin" />;
      default:
        return <BaseNavigator key={`base-${gate}`} />;
    }
  };

  const offline = networkIsDown && !auth.isAuthenticated;
  // Admins keep their console in maintenance; the server lets them through.
  const inMaintenance = maintenance.enabled && gate !== 'admin';

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.colors.canvas}
        translucent
      />
      {!isAppReady ? null : inMaintenance ? (
        <MaintenanceGate />
      ) : offline ? (
        <OfflineGate />
      ) : (
        <NavigationContainer linking={linking} theme={navigationTheme(theme)}>
          {renderNavigator()}
        </NavigationContainer>
      )}
      <PushPrePrompt active={splashGone && isGateCleared(gate)} />
      {splashGone ? null : (
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: splashOpacity }]}
          pointerEvents={splashPlayed && isAppReady ? 'none' : 'auto'}
          onLayout={releaseNativeSplash}>
          <SplashScreen onDone={onSplashPlayed} />
        </Animated.View>
      )}
      <Toast config={toastConfig} topOffset={theme.space.s56} />
    </View>
  );
};

// The root paints canvas so no blank frame shows behind a navigator swap.
const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.canvas },
  });

export default AppContainer;
