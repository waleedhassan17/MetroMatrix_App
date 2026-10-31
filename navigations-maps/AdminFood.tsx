// MetroMatrix — Admin console: the Food tab's stack (and its Kitchen tools).

import type { IRoute } from './types';
import { ROUTES } from './Base';

import FoodOverview from '../screens/food-overview-screen/FoodOverview';
import AdminFoodVendors from '../screens/admin-food-vendors-screen/AdminFoodVendors';
import AdminFoodVendorScreen from '../screens/admin-food-vendor-screen/AdminFoodVendor';
import AdminFoodOrders from '../screens/admin-food-orders-screen/AdminFoodOrders';
import AdminFoodOrder from '../screens/admin-food-order-screen/AdminFoodOrder';
import AdminFoodReviews from '../screens/admin-food-reviews-screen/AdminFoodReviews';
import AdminFoodCuisines from '../screens/admin-food-cuisines-screen/AdminFoodCuisines';
import AdminFoodBanners from '../screens/admin-food-banners-screen/AdminFoodBanners';
import AdminFoodBannerForm from '../screens/admin-food-banner-form-screen/AdminFoodBannerForm';
// The Kitchen tools (5C)
import AdminKitchenAi from '../screens/admin-kitchen-ai-screen/AdminKitchenAi';
import AdminKitchenPrices from '../screens/admin-kitchen-prices-screen/AdminKitchenPrices';
import AdminKitchenNutrition from '../screens/admin-kitchen-nutrition-screen/AdminKitchenNutrition';
import AdminKitchenAliases from '../screens/admin-kitchen-aliases-screen/AdminKitchenAliases';
import AdminKitchenCalendar from '../screens/admin-kitchen-calendar-screen/AdminKitchenCalendar';
import AdminKitchenHygiene from '../screens/admin-kitchen-hygiene-screen/AdminKitchenHygiene';
import AdminKitchenHygieneReview from '../screens/admin-kitchen-hygiene-review-screen/AdminKitchenHygieneReview';
import AdminKitchenSignatures from '../screens/admin-kitchen-signatures-screen/AdminKitchenSignatures';
import AdminKitchenDemand from '../screens/admin-kitchen-demand-screen/AdminKitchenDemand';
import AdminKitchenLookup from '../screens/admin-kitchen-lookup-screen/AdminKitchenLookup';

export const ADMIN_FOOD_ROUTES: IRoute[] = [
  { title: ROUTES.FOOD_OVERVIEW, component: FoodOverview },
  { title: ROUTES.ADMIN_FOOD_VENDORS, component: AdminFoodVendors },
  { title: ROUTES.ADMIN_FOOD_VENDOR, component: AdminFoodVendorScreen },
  { title: ROUTES.ADMIN_FOOD_ORDERS, component: AdminFoodOrders },
  { title: ROUTES.ADMIN_FOOD_ORDER, component: AdminFoodOrder },
  { title: ROUTES.ADMIN_FOOD_REVIEWS, component: AdminFoodReviews },
  { title: ROUTES.ADMIN_FOOD_CUISINES, component: AdminFoodCuisines },
  { title: ROUTES.ADMIN_FOOD_BANNERS, component: AdminFoodBanners },
  { title: ROUTES.ADMIN_FOOD_BANNER_FORM, component: AdminFoodBannerForm },
  { title: ROUTES.ADMIN_KITCHEN_AI, component: AdminKitchenAi },
  { title: ROUTES.ADMIN_KITCHEN_PRICES, component: AdminKitchenPrices },
  { title: ROUTES.ADMIN_KITCHEN_NUTRITION, component: AdminKitchenNutrition },
  { title: ROUTES.ADMIN_KITCHEN_ALIASES, component: AdminKitchenAliases },
  { title: ROUTES.ADMIN_KITCHEN_CALENDAR, component: AdminKitchenCalendar },
  { title: ROUTES.ADMIN_KITCHEN_HYGIENE, component: AdminKitchenHygiene },
  { title: ROUTES.ADMIN_KITCHEN_HYGIENE_REVIEW, component: AdminKitchenHygieneReview },
  { title: ROUTES.ADMIN_KITCHEN_SIGNATURES, component: AdminKitchenSignatures },
  { title: ROUTES.ADMIN_KITCHEN_DEMAND, component: AdminKitchenDemand },
  { title: ROUTES.ADMIN_KITCHEN_LOOKUP, component: AdminKitchenLookup },
];
