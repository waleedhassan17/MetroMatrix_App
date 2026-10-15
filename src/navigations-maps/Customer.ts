// MetroMatrix — Customer app tabs (Home, Orders, Profile).

import type { ITabRoute } from './types';
import { ROUTES } from './Base';

import HomeStack from '../navigators/stacks/HomeStack';
import OrdersScreen from '../screens/Customer/Orders/OrdersScreen';
import AccountStack from '../navigators/stacks/AccountStack';

export const CUSTOMER_TAB_ROUTES: ITabRoute[] = [
  { title: ROUTES.HOME_TAB, component: HomeStack, label: 'Home', icon: 'home' },
  { title: ROUTES.ORDERS_TAB, component: OrdersScreen, label: 'Orders', icon: 'package' },
  { title: ROUTES.PROFILE_TAB, component: AccountStack, label: 'Profile', icon: 'user' },
];
