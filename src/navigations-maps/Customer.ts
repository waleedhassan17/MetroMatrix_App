// MetroMatrix — Customer app tabs (Home, Orders, Profile).

import type { ITabRoute } from './types';
import { ROUTES } from './Base';

import HomeStack from '../navigators/stacks/HomeStack';
import OrdersStack from '../navigators/stacks/OrdersStack';
import AccountStack from '../navigators/stacks/AccountStack';

export const CUSTOMER_TAB_ROUTES: ITabRoute[] = [
  {
    title: ROUTES.HOME_TAB,
    component: HomeStack,
    label: 'Home',
    icon: 'home-outline',
    iconActive: 'home',
  },
  {
    title: ROUTES.ORDERS_TAB,
    component: OrdersStack,
    label: 'Orders',
    icon: 'receipt-outline',
    iconActive: 'receipt',
  },
  {
    title: ROUTES.PROFILE_TAB,
    component: AccountStack,
    label: 'Profile',
    icon: 'person-circle-outline',
    iconActive: 'person-circle',
  },
];
