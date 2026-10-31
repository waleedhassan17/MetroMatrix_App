// ═══════════════════════════════════════════════════════
// MetroMatrix — The Food rider's app
// ═══════════════════════════════════════════════════════
// Deliveries · Cash · Profile at the root of a stack, for a rider a vendor
// added (they sign in with the username the vendor gave them).

import type { IRoute, ITabRoute } from './types';
import { ROUTES } from './Base';

import RiderDeliveries from '../screens/rider-deliveries-screen/RiderDeliveries';
import RiderCash from '../screens/rider-cash-screen/RiderCash';
import RiderProfile from '../screens/rider-profile-screen/RiderProfile';
import ChangePassword from '../screens/change-password-screen/ChangePassword';
import Notifications from '../screens/notifications-screen/Notifications';
import RiderOrder from '../screens/rider-order-screen/RiderOrder';

export const RIDER_TABS: ITabRoute[] = [
  { title: ROUTES.DELIVERIES_TAB, component: RiderDeliveries, label: 'Deliveries', icon: 'bicycle-outline', iconActive: 'bicycle' },
  { title: ROUTES.CASH_TAB, component: RiderCash, label: 'Cash', icon: 'cash-outline', iconActive: 'cash' },
  { title: ROUTES.RIDER_PROFILE_TAB, component: RiderProfile, label: 'Profile', icon: 'person-circle-outline', iconActive: 'person-circle' },
];

export const RIDER_STACK_ROUTES: IRoute[] = [
  { title: ROUTES.RIDER_ORDER, component: RiderOrder },
  { title: ROUTES.CHANGE_PASSWORD, component: ChangePassword },
  { title: ROUTES.NOTIFICATIONS, component: Notifications },
];
