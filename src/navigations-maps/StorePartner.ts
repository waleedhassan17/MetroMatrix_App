// ═══════════════════════════════════════════════════════
// MetroMatrix — The store partner's app
// ═══════════════════════════════════════════════════════
// Four tabs (Today · Orders · Products · More) at the root of a stack;
// every tool pushes over the tabs.

import type { IRoute, ITabRoute } from './types';
import { ROUTES } from './Base';

import StoreTodayScreen from '../screens/Shopping/Store/StoreToday/StoreTodayScreen';
import StoreOrdersScreen from '../screens/Shopping/Store/StoreOrders/StoreOrdersScreen';
import StoreProductsScreen from '../screens/Shopping/Store/StoreProducts/StoreProductsScreen';
import StoreMoreScreen from '../screens/Shopping/Store/StoreMore/StoreMoreScreen';
import StoreOrderDetailScreen from '../screens/Shopping/Store/StoreOrderDetail/StoreOrderDetailScreen';
import ProductFormScreen from '../screens/Shopping/Store/ProductForm/ProductFormScreen';
import InventoryScreen from '../screens/Shopping/Store/Inventory/InventoryScreen';
import CollectionsScreen from '../screens/Shopping/Store/Collections/CollectionsScreen';
import CouponsScreen from '../screens/Shopping/Store/Coupons/CouponsScreen';
import CouponFormScreen from '../screens/Shopping/Store/CouponForm/CouponFormScreen';
import StoreReturnsScreen from '../screens/Shopping/Store/StoreReturns/StoreReturnsScreen';
import StoreReturnDetailScreen from '../screens/Shopping/Store/StoreReturnDetail/StoreReturnDetailScreen';
import StoreReviewsScreen from '../screens/Shopping/Store/StoreReviews/StoreReviewsScreen';
import InsightsScreen from '../screens/Shopping/Store/Insights/InsightsScreen';
import StoreProfileScreen from '../screens/Shopping/Store/StoreProfile/StoreProfileScreen';
import StoreSettingsScreen from '../screens/Shopping/Store/StoreSettings/StoreSettingsScreen';
import PaymentAccountsScreen from '../screens/Shopping/Store/PaymentAccounts/PaymentAccountsScreen';
import ProfileScreen from '../screens/Account/Profile/ProfileScreen';
import ChangePasswordScreen from '../screens/Account/ChangePassword/ChangePasswordScreen';
import NotificationsScreen from '../screens/Account/Notifications/NotificationsScreen';

export const STORE_PARTNER_TABS: ITabRoute[] = [
  { title: ROUTES.HOME_TAB, component: StoreTodayScreen, label: 'Today', icon: 'today-outline', iconActive: 'today' },
  { title: ROUTES.ORDERS_TAB, component: StoreOrdersScreen, label: 'Orders', icon: 'receipt-outline', iconActive: 'receipt' },
  { title: ROUTES.PRODUCTS_TAB, component: StoreProductsScreen, label: 'Products', icon: 'pricetags-outline', iconActive: 'pricetags' },
  { title: ROUTES.MORE_TAB, component: StoreMoreScreen, label: 'More', icon: 'grid-outline', iconActive: 'grid' },
];

/** Pushed over the tabs (the tabs themselves are the stack's first screen). */
export const STORE_PARTNER_STACK_ROUTES: IRoute[] = [
  { title: ROUTES.STORE_ORDER_DETAIL, component: StoreOrderDetailScreen },
  { title: ROUTES.PRODUCT_FORM, component: ProductFormScreen },
  { title: ROUTES.INVENTORY, component: InventoryScreen },
  { title: ROUTES.COLLECTIONS, component: CollectionsScreen },
  { title: ROUTES.COUPONS, component: CouponsScreen },
  { title: ROUTES.COUPON_FORM, component: CouponFormScreen },
  { title: ROUTES.STORE_RETURNS, component: StoreReturnsScreen },
  { title: ROUTES.STORE_RETURN_DETAIL, component: StoreReturnDetailScreen },
  { title: ROUTES.STORE_REVIEWS, component: StoreReviewsScreen },
  { title: ROUTES.INSIGHTS, component: InsightsScreen },
  { title: ROUTES.STORE_PROFILE, component: StoreProfileScreen },
  { title: ROUTES.STORE_SETTINGS, component: StoreSettingsScreen },
  { title: ROUTES.PAYMENT_ACCOUNTS, component: PaymentAccountsScreen },
  { title: ROUTES.PROFILE, component: ProfileScreen },
  { title: ROUTES.CHANGE_PASSWORD, component: ChangePasswordScreen },
  { title: ROUTES.NOTIFICATIONS, component: NotificationsScreen },
];
