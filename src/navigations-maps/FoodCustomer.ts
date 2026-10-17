// MetroMatrix — The customer's Food Court app: its own tabs (Home · Orders ·
// Profile), in the FYP Home services bar's look, with browsing — vendor
// lists, search, a vendor's page — pushed over them.

import type { IRoute, ITabRoute } from './types';
import { ROUTES } from './Base';

import FoodHomeScreen from '../screens/Food/Customer/FoodHome/FoodHomeScreen';
import FoodOrdersScreen from '../screens/Customer/FoodOrders/FoodOrdersScreen';
import ProfileScreen from '../screens/Account/Profile/ProfileScreen';
import FoodVendorsScreen from '../screens/Food/Customer/FoodVendors/FoodVendorsScreen';
import FoodSearchScreen from '../screens/Food/Customer/FoodSearch/FoodSearchScreen';
import FoodVendorScreen from '../screens/Food/Customer/FoodVendor/FoodVendorScreen';

const AS_TAB = { asTab: true };

export const FOOD_TABS: ITabRoute[] = [
  { title: ROUTES.FOOD_HOME_TAB, component: FoodHomeScreen, label: 'Home', icon: 'home-outline', iconActive: 'home', initialParams: AS_TAB },
  { title: ROUTES.FOOD_ORDERS_TAB, component: FoodOrdersScreen, label: 'Orders', icon: 'receipt-outline', iconActive: 'receipt', initialParams: AS_TAB },
  { title: ROUTES.FOOD_PROFILE_TAB, component: ProfileScreen, label: 'Profile', icon: 'person-outline', iconActive: 'person', initialParams: AS_TAB },
];

/** Pushed over the tabs. */
export const FOOD_STACK_ROUTES: IRoute[] = [
  { title: ROUTES.FOOD_VENDORS, component: FoodVendorsScreen },
  { title: ROUTES.FOOD_SEARCH, component: FoodSearchScreen, options: { animation: 'fade' } },
  { title: ROUTES.FOOD_VENDOR, component: FoodVendorScreen },
];
