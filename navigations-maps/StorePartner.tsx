// ═══════════════════════════════════════════════════════
// MetroMatrix — The store partner's app
// ═══════════════════════════════════════════════════════
// Four tabs (Today · Orders · Products · More) at the root of a stack;
// every tool pushes over the tabs.

import type { IRoute, ITabRoute } from './types';
import { ROUTES } from './Base';

import StoreToday from '../screens/store-today-screen/StoreToday';
import StoreOrders from '../screens/store-orders-screen/StoreOrders';
import StoreProducts from '../screens/store-products-screen/StoreProducts';
import StoreMore from '../screens/store-more-screen/StoreMore';
import StoreOrderDetail from '../screens/store-order-detail-screen/StoreOrderDetail';
import ProductForm from '../screens/product-form-screen/ProductForm';
import Inventory from '../screens/inventory-screen/Inventory';
import Collections from '../screens/collections-screen/Collections';
import Coupons from '../screens/coupons-screen/Coupons';
import CouponForm from '../screens/coupon-form-screen/CouponForm';
import StoreReturns from '../screens/store-returns-screen/StoreReturns';
import StoreReturnDetail from '../screens/store-return-detail-screen/StoreReturnDetail';
import StoreReviews from '../screens/store-reviews-screen/StoreReviews';
import Insights from '../screens/insights-screen/Insights';
import StoreProfile from '../screens/store-profile-screen/StoreProfile';
import StoreSettingsScreen from '../screens/store-settings-screen/StoreSettings';
import PaymentAccounts from '../screens/payment-accounts-screen/PaymentAccounts';
import Profile from '../screens/profile-screen/Profile';
import ChangePassword from '../screens/change-password-screen/ChangePassword';
import Notifications from '../screens/notifications-screen/Notifications';

export const STORE_PARTNER_TABS: ITabRoute[] = [
  { title: ROUTES.HOME_TAB, component: StoreToday, label: 'Today', icon: 'today-outline', iconActive: 'today' },
  { title: ROUTES.ORDERS_TAB, component: StoreOrders, label: 'Orders', icon: 'receipt-outline', iconActive: 'receipt' },
  { title: ROUTES.PRODUCTS_TAB, component: StoreProducts, label: 'Products', icon: 'pricetags-outline', iconActive: 'pricetags' },
  { title: ROUTES.MORE_TAB, component: StoreMore, label: 'More', icon: 'grid-outline', iconActive: 'grid' },
];

/** Pushed over the tabs (the tabs themselves are the stack's first screen). */
export const STORE_PARTNER_STACK_ROUTES: IRoute[] = [
  { title: ROUTES.STORE_ORDER_DETAIL, component: StoreOrderDetail },
  { title: ROUTES.PRODUCT_FORM, component: ProductForm },
  { title: ROUTES.INVENTORY, component: Inventory },
  { title: ROUTES.COLLECTIONS, component: Collections },
  { title: ROUTES.COUPONS, component: Coupons },
  { title: ROUTES.COUPON_FORM, component: CouponForm },
  { title: ROUTES.STORE_RETURNS, component: StoreReturns },
  { title: ROUTES.STORE_RETURN_DETAIL, component: StoreReturnDetail },
  { title: ROUTES.STORE_REVIEWS, component: StoreReviews },
  { title: ROUTES.INSIGHTS, component: Insights },
  { title: ROUTES.STORE_PROFILE, component: StoreProfile },
  { title: ROUTES.STORE_SETTINGS, component: StoreSettingsScreen },
  { title: ROUTES.PAYMENT_ACCOUNTS, component: PaymentAccounts },
  { title: ROUTES.PROFILE, component: Profile },
  { title: ROUTES.CHANGE_PASSWORD, component: ChangePassword },
  { title: ROUTES.NOTIFICATIONS, component: Notifications },
];
