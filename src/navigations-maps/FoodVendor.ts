// ═══════════════════════════════════════════════════════
// MetroMatrix — The Food vendor's app (restaurant, home or cloud kitchen)
// ═══════════════════════════════════════════════════════
// Orders · Menu · Riders · More at the root of a stack; every tool pushes over
// the tabs. Until the kitchen is live the stack opens on Kitchen setup
// instead (sessionGate.foodVendorRootRoute).

import type { IRoute, ITabRoute } from './types';
import { ROUTES } from './Base';

import VendorOrdersScreen from '../screens/Food/Vendor/VendorOrders/VendorOrdersScreen';
import VendorMenuScreen from '../screens/Food/Vendor/VendorMenu/VendorMenuScreen';
import VendorRidersScreen from '../screens/Food/Vendor/VendorRiders/VendorRidersScreen';
import VendorMoreScreen from '../screens/Food/Vendor/VendorMore/VendorMoreScreen';
import VendorSetupScreen from '../screens/Food/Vendor/VendorSetup/VendorSetupScreen';
import VendorBrandScreen from '../screens/Food/Vendor/VendorBrand/VendorBrandScreen';
import VendorSettingsScreen from '../screens/Food/Vendor/VendorSettings/VendorSettingsScreen';
import VendorHoursScreen from '../screens/Food/Vendor/VendorHours/VendorHoursScreen';
import VendorZonesScreen from '../screens/Food/Vendor/VendorZones/VendorZonesScreen';
import VendorClosuresScreen from '../screens/Food/Vendor/VendorClosures/VendorClosuresScreen';
import VendorPlanScreen from '../screens/Food/Vendor/VendorPlan/VendorPlanScreen';
import RiderDetailScreen from '../screens/Food/Vendor/RiderDetail/RiderDetailScreen';
import PaymentAccountsScreen from '../screens/Shopping/Store/PaymentAccounts/PaymentAccountsScreen';
import ProfileScreen from '../screens/Account/Profile/ProfileScreen';
import ChangePasswordScreen from '../screens/Account/ChangePassword/ChangePasswordScreen';
import NotificationsScreen from '../screens/Account/Notifications/NotificationsScreen';

export const FOOD_VENDOR_TABS: ITabRoute[] = [
  { title: ROUTES.ORDERS_TAB, component: VendorOrdersScreen, label: 'Orders', icon: 'receipt-outline', iconActive: 'receipt' },
  { title: ROUTES.MENU_TAB, component: VendorMenuScreen, label: 'Menu', icon: 'book-outline', iconActive: 'book' },
  { title: ROUTES.RIDERS_TAB, component: VendorRidersScreen, label: 'Riders', icon: 'bicycle-outline', iconActive: 'bicycle' },
  { title: ROUTES.MORE_TAB, component: VendorMoreScreen, label: 'More', icon: 'grid-outline', iconActive: 'grid' },
];

/** Pushed over the tabs (the tabs, or Kitchen setup, are the stack's first screen). */
export const FOOD_VENDOR_STACK_ROUTES: IRoute[] = [
  { title: ROUTES.VENDOR_SETUP, component: VendorSetupScreen },
  { title: ROUTES.VENDOR_BRAND, component: VendorBrandScreen },
  { title: ROUTES.VENDOR_SETTINGS, component: VendorSettingsScreen },
  { title: ROUTES.VENDOR_HOURS, component: VendorHoursScreen },
  { title: ROUTES.VENDOR_ZONES, component: VendorZonesScreen },
  { title: ROUTES.VENDOR_CLOSURES, component: VendorClosuresScreen },
  { title: ROUTES.VENDOR_PLAN, component: VendorPlanScreen },
  { title: ROUTES.VENDOR_RIDER_DETAIL, component: RiderDetailScreen },
  { title: ROUTES.PAYMENT_ACCOUNTS, component: PaymentAccountsScreen },
  { title: ROUTES.PROFILE, component: ProfileScreen },
  { title: ROUTES.CHANGE_PASSWORD, component: ChangePasswordScreen },
  { title: ROUTES.NOTIFICATIONS, component: NotificationsScreen },
];
