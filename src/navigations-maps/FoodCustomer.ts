// MetroMatrix — The customer's Food Court app: its own tabs (Home · Orders ·
// Profile), in the FYP Home services bar's look. Menus and ordering push over
// the tabs when they ship.

import type { ITabRoute } from './types';
import { ROUTES } from './Base';

import FoodHomeScreen from '../screens/Customer/FoodHome/FoodHomeScreen';
import FoodOrdersScreen from '../screens/Customer/FoodOrders/FoodOrdersScreen';
import ProfileScreen from '../screens/Account/Profile/ProfileScreen';

const AS_TAB = { asTab: true };

export const FOOD_TABS: ITabRoute[] = [
  { title: ROUTES.FOOD_HOME_TAB, component: FoodHomeScreen, label: 'Home', icon: 'home-outline', iconActive: 'home', initialParams: AS_TAB },
  { title: ROUTES.FOOD_ORDERS_TAB, component: FoodOrdersScreen, label: 'Orders', icon: 'receipt-outline', iconActive: 'receipt', initialParams: AS_TAB },
  { title: ROUTES.FOOD_PROFILE_TAB, component: ProfileScreen, label: 'Profile', icon: 'person-outline', iconActive: 'person', initialParams: AS_TAB },
];
