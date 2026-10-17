// ═══════════════════════════════════════════════════════
// MetroMatrix — The Food rider's app
// ═══════════════════════════════════════════════════════
// Deliveries · Cash · Profile at the root of a stack, for a rider a vendor
// added (they sign in with the username the vendor gave them).

import type { IRoute, ITabRoute } from './types';
import { ROUTES } from './Base';

import RiderDeliveriesScreen from '../screens/Food/Rider/RiderDeliveries/RiderDeliveriesScreen';
import RiderCashScreen from '../screens/Food/Rider/RiderCash/RiderCashScreen';
import RiderProfileScreen from '../screens/Food/Rider/RiderProfile/RiderProfileScreen';
import ChangePasswordScreen from '../screens/Account/ChangePassword/ChangePasswordScreen';
import NotificationsScreen from '../screens/Account/Notifications/NotificationsScreen';

export const RIDER_TABS: ITabRoute[] = [
  { title: ROUTES.DELIVERIES_TAB, component: RiderDeliveriesScreen, label: 'Deliveries', icon: 'bicycle-outline', iconActive: 'bicycle' },
  { title: ROUTES.CASH_TAB, component: RiderCashScreen, label: 'Cash', icon: 'cash-outline', iconActive: 'cash' },
  { title: ROUTES.RIDER_PROFILE_TAB, component: RiderProfileScreen, label: 'Profile', icon: 'person-circle-outline', iconActive: 'person-circle' },
];

export const RIDER_STACK_ROUTES: IRoute[] = [
  { title: ROUTES.CHANGE_PASSWORD, component: ChangePasswordScreen },
  { title: ROUTES.NOTIFICATIONS, component: NotificationsScreen },
];
