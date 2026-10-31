// MetroMatrix — Admin console: the Food tab's stack (and its Kitchen tools).

import type { IRoute } from './types';
import { ROUTES } from './Base';

import FoodOverviewScreen from '../screens/Admin/Food/FoodOverview/FoodOverviewScreen';
import AdminFoodVendorsScreen from '../screens/Admin/Food/AdminFoodVendors/AdminFoodVendorsScreen';
import AdminFoodVendorScreen from '../screens/Admin/Food/AdminFoodVendor/AdminFoodVendorScreen';
import AdminFoodOrdersScreen from '../screens/Admin/Food/AdminFoodOrders/AdminFoodOrdersScreen';
import AdminFoodOrderScreen from '../screens/Admin/Food/AdminFoodOrder/AdminFoodOrderScreen';
import AdminFoodReviewsScreen from '../screens/Admin/Food/AdminFoodReviews/AdminFoodReviewsScreen';
import AdminFoodCuisinesScreen from '../screens/Admin/Food/AdminFoodCuisines/AdminFoodCuisinesScreen';
import AdminFoodBannersScreen from '../screens/Admin/Food/AdminFoodBanners/AdminFoodBannersScreen';
import AdminFoodBannerFormScreen from '../screens/Admin/Food/AdminFoodBannerForm/AdminFoodBannerFormScreen';
// The Kitchen tools (5C)
import AdminKitchenAiScreen from '../screens/Admin/Kitchen/AdminKitchenAi/AdminKitchenAiScreen';
import AdminKitchenPricesScreen from '../screens/Admin/Kitchen/AdminKitchenPrices/AdminKitchenPricesScreen';
import AdminKitchenNutritionScreen from '../screens/Admin/Kitchen/AdminKitchenNutrition/AdminKitchenNutritionScreen';
import AdminKitchenAliasesScreen from '../screens/Admin/Kitchen/AdminKitchenAliases/AdminKitchenAliasesScreen';
import AdminKitchenCalendarScreen from '../screens/Admin/Kitchen/AdminKitchenCalendar/AdminKitchenCalendarScreen';
import AdminKitchenHygieneScreen from '../screens/Admin/Kitchen/AdminKitchenHygiene/AdminKitchenHygieneScreen';
import AdminKitchenHygieneReviewScreen from '../screens/Admin/Kitchen/AdminKitchenHygieneReview/AdminKitchenHygieneReviewScreen';
import AdminKitchenSignaturesScreen from '../screens/Admin/Kitchen/AdminKitchenSignatures/AdminKitchenSignaturesScreen';
import AdminKitchenDemandScreen from '../screens/Admin/Kitchen/AdminKitchenDemand/AdminKitchenDemandScreen';
import AdminKitchenLookupScreen from '../screens/Admin/Kitchen/AdminKitchenLookup/AdminKitchenLookupScreen';

export const ADMIN_FOOD_ROUTES: IRoute[] = [
  { title: ROUTES.FOOD_OVERVIEW, component: FoodOverviewScreen },
  { title: ROUTES.ADMIN_FOOD_VENDORS, component: AdminFoodVendorsScreen },
  { title: ROUTES.ADMIN_FOOD_VENDOR, component: AdminFoodVendorScreen },
  { title: ROUTES.ADMIN_FOOD_ORDERS, component: AdminFoodOrdersScreen },
  { title: ROUTES.ADMIN_FOOD_ORDER, component: AdminFoodOrderScreen },
  { title: ROUTES.ADMIN_FOOD_REVIEWS, component: AdminFoodReviewsScreen },
  { title: ROUTES.ADMIN_FOOD_CUISINES, component: AdminFoodCuisinesScreen },
  { title: ROUTES.ADMIN_FOOD_BANNERS, component: AdminFoodBannersScreen },
  { title: ROUTES.ADMIN_FOOD_BANNER_FORM, component: AdminFoodBannerFormScreen },
  { title: ROUTES.ADMIN_KITCHEN_AI, component: AdminKitchenAiScreen },
  { title: ROUTES.ADMIN_KITCHEN_PRICES, component: AdminKitchenPricesScreen },
  { title: ROUTES.ADMIN_KITCHEN_NUTRITION, component: AdminKitchenNutritionScreen },
  { title: ROUTES.ADMIN_KITCHEN_ALIASES, component: AdminKitchenAliasesScreen },
  { title: ROUTES.ADMIN_KITCHEN_CALENDAR, component: AdminKitchenCalendarScreen },
  { title: ROUTES.ADMIN_KITCHEN_HYGIENE, component: AdminKitchenHygieneScreen },
  { title: ROUTES.ADMIN_KITCHEN_HYGIENE_REVIEW, component: AdminKitchenHygieneReviewScreen },
  { title: ROUTES.ADMIN_KITCHEN_SIGNATURES, component: AdminKitchenSignaturesScreen },
  { title: ROUTES.ADMIN_KITCHEN_DEMAND, component: AdminKitchenDemandScreen },
  { title: ROUTES.ADMIN_KITCHEN_LOOKUP, component: AdminKitchenLookupScreen },
];
