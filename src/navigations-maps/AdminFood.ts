// MetroMatrix — Admin console: the Food tab's stack.

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
];
