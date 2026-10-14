// MetroMatrix — Customer app tabs (Home, Orders, Profile).

import type { ITabRoute } from './types';
import { ROUTES } from './Base';

import CustomerHomeScreen from '../screens/Customer/CustomerHome/CustomerHomeScreen';
import OrdersScreen from '../screens/Customer/Orders/OrdersScreen';
import AccountStack from '../navigators/stacks/AccountStack';

export const CUSTOMER_TAB_ROUTES: ITabRoute[] = [
  { title: ROUTES.HOME_TAB, component: CustomerHomeScreen, label: 'Home', icon: 'home' },
  { title: ROUTES.ORDERS_TAB, component: OrdersScreen, label: 'Orders', icon: 'package' },
  { title: ROUTES.PROFILE_TAB, component: AccountStack, label: 'Profile', icon: 'user' },
];
